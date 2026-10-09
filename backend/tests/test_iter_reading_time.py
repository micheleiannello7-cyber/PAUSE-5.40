"""Verify reading_time_min / deep_dive_time_min reflect silent-reading estimate
(~210 wpm) and audio_time_min reflects TTS narration. See iteration plan."""
import os
import re
import pytest
import requests
from pymongo import MongoClient

def _env(*keys):
    for k in keys:
        v = os.environ.get(k)
        if v:
            return v
    raise RuntimeError(f"Missing env: {keys}")

# Load env from .env files when run outside supervisor-managed services.
from pathlib import Path
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:
    pass

BASE_URL = _env('EXPO_BACKEND_URL', 'EXPO_PUBLIC_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"

MONGO_URL = _env('MONGO_URL')
DB_NAME = _env('DB_NAME')

_mdb = MongoClient(MONGO_URL)[DB_NAME]


def _word_count(doc, lang="it"):
    parts = [doc.get("title") or "", doc.get("hook") or ""]
    chapters = doc.get("chapters") or []
    if lang == "en" and doc.get("translations", {}).get("en"):
        tr = doc["translations"]["en"]
        parts = [tr.get("title") or doc.get("title") or "",
                 tr.get("hook") or doc.get("hook") or ""]
        tr_ch = tr.get("chapters") or []
        new = []
        for i, b in enumerate(chapters):
            t = tr_ch[i] if i < len(tr_ch) else {}
            new.append({"title": t.get("title") or b.get("title") or "",
                        "body": t.get("body") or b.get("body") or ""})
        chapters = new
    for ch in chapters:
        parts += [ch.get("title") or "", ch.get("body") or ""]
    return len(re.findall(r"\w+", " ".join(parts)))


# --- Catalog list endpoint reading_time_min values -------------------------
class TestListReadingTimes:
    def test_italian_catalog_shows_small_minute_badges(self):
        r = requests.get(f"{API}/stories", params={"lang": "it", "limit": 50}, timeout=20)
        assert r.status_code == 200
        stories = r.json()
        assert len(stories) >= 10
        for s in stories:
            assert isinstance(s.get("reading_time_min"), int)
            assert isinstance(s.get("deep_dive_time_min"), int)
            assert isinstance(s.get("audio_time_min"), int)
            # Reading estimate for current catalog should sit in 1-4 min
            # (the user bug: previously many showed 5 min).
            assert 1 <= s["reading_time_min"] <= 4, f"{s['id']} rtm={s['reading_time_min']}"
            # Reading badge must equal deep_dive badge (both drive the "N min" UI pill).
            assert s["reading_time_min"] == s["deep_dive_time_min"]
            # Audio estimate is independent and should be larger (TTS is slower than silent reading).
            assert s["audio_time_min"] >= s["reading_time_min"]

    def test_english_catalog_returns_minutes(self):
        r = requests.get(f"{API}/stories", params={"lang": "en", "limit": 50}, timeout=20)
        assert r.status_code == 200
        for s in r.json():
            assert 1 <= s["reading_time_min"] <= 5
            assert s["audio_time_min"] >= 1

    def test_no_story_shows_disproportionate_5min_badge(self):
        """At least 80% of catalog should be <= 3 min; a 5-min badge is only
        for the handful of unusually long items (if any)."""
        r = requests.get(f"{API}/stories", params={"lang": "it", "limit": 500}, timeout=30)
        rtm = [s["reading_time_min"] for s in r.json()]
        assert len(rtm) > 50
        short = sum(1 for v in rtm if v <= 3)
        assert short / len(rtm) >= 0.8, f"only {short}/{len(rtm)} stories <=3min"


# --- Consistency between list and detail -----------------------------------
class TestListVsDetailConsistency:
    def test_same_minutes_in_list_and_detail_it(self):
        r = requests.get(f"{API}/stories", params={"lang": "it", "limit": 10}, timeout=20)
        for s in r.json()[:5]:
            d = requests.get(f"{API}/stories/{s['id']}", params={"lang": "it"}, timeout=20).json()
            assert d["reading_time_min"] == s["reading_time_min"], f"{s['id']} list={s['reading_time_min']} detail={d['reading_time_min']}"
            assert d["deep_dive_time_min"] == s["deep_dive_time_min"]
            assert d["audio_time_min"] == s["audio_time_min"]

    def test_same_minutes_in_list_and_detail_en(self):
        r = requests.get(f"{API}/stories", params={"lang": "en", "limit": 10}, timeout=20)
        for s in r.json()[:5]:
            d = requests.get(f"{API}/stories/{s['id']}", params={"lang": "en"}, timeout=20).json()
            assert d["reading_time_min"] == s["reading_time_min"]
            assert d["audio_time_min"] == s["audio_time_min"]


# --- DB-level: reading_minutes_est populated for every story ---------------
class TestDbReadingMinutesEst:
    def test_every_story_has_reading_minutes_est_it(self):
        missing = list(_mdb.stories.find(
            {"$or": [
                {"reading_minutes_est": {"$exists": False}},
                {"reading_minutes_est.it": {"$exists": False}},
            ]},
            {"_id": 0, "id": 1},
        ))
        assert missing == [], f"{len(missing)} stories missing reading_minutes_est.it"

    def test_every_translated_story_has_reading_minutes_est_en(self):
        # EN estimate only required when the translation exists.
        total_with_tr = _mdb.stories.count_documents({"translations.en.title": {"$exists": True}})
        assert total_with_tr > 0
        missing = list(_mdb.stories.find(
            {"translations.en.title": {"$exists": True},
             "$or": [
                 {"reading_minutes_est.en": {"$exists": False}},
                 {"reading_minutes_est.en": None},
             ]},
            {"_id": 0, "id": 1},
        ))
        assert missing == [], f"{len(missing)}/{total_with_tr} translated stories missing reading_minutes_est.en"

    def test_catalog_total_count(self):
        total = _mdb.stories.count_documents({})
        assert total >= 490, f"expected ~493 stories, found {total}"

    def test_reading_estimate_matches_wpm_formula(self):
        """Spot-check: estimate ~ round(words/210 min + 3s/chapter)."""
        for doc in _mdb.stories.find({}, {"_id": 0, "id": 1, "title": 1, "hook": 1,
                                           "chapters": 1, "translations": 1,
                                           "reading_minutes_est": 1}).limit(20):
            words = _word_count(doc, "it")
            chapters = len(doc.get("chapters") or [])
            expected = max(1, int(round(words / 210 + chapters * 3 / 60)))
            got = (doc.get("reading_minutes_est") or {}).get("it")
            assert got is not None
            # Allow 1 min slack for word-tokenization differences.
            assert abs(got - expected) <= 1, f"{doc['id']} expected≈{expected} got={got} words={words}"


# --- Playlist endpoint still uses the audio time ---------------------------
class TestPlaylistUsesAudio:
    def test_playlist_total_min_sums_audio_minutes(self):
        uid = "TEST_rtm_playlist_user"
        requests.post(f"{API}/user/premium", json={"user_id": uid, "active": False}, timeout=10)
        r = requests.get(f"{API}/playlist", params={"user_id": uid, "minutes": 10, "lang": "it"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        if not data["stories"]:
            pytest.skip("No stories matched playlist filters")
        # Audio minutes should be present on every story.
        for s in data["stories"]:
            assert s.get("audio_time_min") and s["audio_time_min"] >= 1
        # Clean up
        _mdb.user_state.delete_one({"user_id": uid})
