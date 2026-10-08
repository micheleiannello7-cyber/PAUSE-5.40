"""Smoke tests after PAUSE codebase import — core endpoints must respond with real data.

Covers: health, categories, stories listing/detail, discover-batch, user state,
bookmark toggle. TTS and Stripe are intentionally not configured in this preview
and are therefore skipped.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or \
           os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback to local in case env not exported in shell
    BASE_URL = "http://localhost:8001"

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_id():
    return f"TEST_{uuid.uuid4().hex[:12]}"


# --- health ----------------------------------------------------------------
class TestHealth:
    def test_health_ok(self, session):
        r = session.get(f"{API}/health", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["db"] is True


# --- categories ------------------------------------------------------------
class TestCategories:
    def test_categories_list(self, session):
        r = session.get(f"{API}/categories", timeout=15)
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) >= 12, f"Expected >=12 categories, got {len(cats)}"
        c = cats[0]
        for k in ("id", "name", "icon", "color", "story_count"):
            assert k in c

    def test_categories_en(self, session):
        r = session.get(f"{API}/categories?lang=en", timeout=15)
        assert r.status_code == 200
        names = {c["id"]: c["name"] for c in r.json()}
        # English name for Animals should be localized
        assert names.get("animali") in ("Animals", "animali", None) or names["animali"] != "Animali"


# --- stories ---------------------------------------------------------------
class TestStories:
    def test_stories_list_default(self, session):
        r = session.get(f"{API}/stories?limit=50", timeout=20)
        assert r.status_code == 200
        stories = r.json()
        assert isinstance(stories, list)
        assert len(stories) >= 1
        s = stories[0]
        for k in ("id", "title", "category_id", "category_name", "reading_time_min"):
            assert k in s

    def test_stories_filter_by_category(self, session):
        r = session.get(f"{API}/stories?category_id=animali&limit=20", timeout=20)
        assert r.status_code == 200
        docs = r.json()
        assert isinstance(docs, list)
        for d in docs:
            assert d["category_id"] == "animali"

    def test_story_detail(self, session):
        lst = session.get(f"{API}/stories?limit=5", timeout=20).json()
        assert lst, "no stories available"
        sid = lst[0]["id"]
        r = session.get(f"{API}/stories/{sid}", timeout=20)
        assert r.status_code == 200
        story = r.json()
        assert story["id"] == sid
        assert isinstance(story.get("chapters"), list)
        assert len(story["chapters"]) >= 1

    def test_story_not_found(self, session):
        r = session.get(f"{API}/stories/does-not-exist", timeout=15)
        assert r.status_code == 404


# --- discover --------------------------------------------------------------
class TestDiscover:
    def test_discover_batch(self, session, user_id):
        r = session.get(f"{API}/discover-batch?user_id={user_id}&count=5", timeout=25)
        assert r.status_code == 200, r.text
        deck = r.json()
        assert isinstance(deck, list)
        assert 1 <= len(deck) <= 5
        ids = [d["id"] for d in deck]
        assert len(ids) == len(set(ids)), "Deck must contain unique stories"


# --- user flow -------------------------------------------------------------
class TestUserFlow:
    def test_create_user_state(self, session, user_id):
        r = session.get(f"{API}/user/{user_id}", timeout=15)
        assert r.status_code == 200
        state = r.json()
        assert state["user_id"] == user_id
        assert state["bookmarked_story_ids"] == []

    def test_set_interests(self, session, user_id):
        r = session.post(f"{API}/user/interests",
                         json={"user_id": user_id, "interests": ["animali", "spazio"]},
                         timeout=15)
        assert r.status_code == 200
        state = r.json()
        assert set(state["interests"]) >= {"animali", "spazio"}

    def test_bookmark_toggle_and_verify(self, session, user_id):
        lst = session.get(f"{API}/stories?limit=1", timeout=15).json()
        sid = lst[0]["id"]

        r = session.post(f"{API}/user/bookmark",
                         json={"user_id": user_id, "story_id": sid}, timeout=15)
        assert r.status_code == 200
        assert sid in r.json()["bookmarked_story_ids"]

        # verify via /bookmarks GET
        r2 = session.get(f"{API}/user/{user_id}/bookmarks", timeout=15)
        assert r2.status_code == 200
        assert any(x["id"] == sid for x in r2.json())

        # toggle off
        r3 = session.post(f"{API}/user/bookmark",
                          json={"user_id": user_id, "story_id": sid}, timeout=15)
        assert r3.status_code == 200
        assert sid not in r3.json()["bookmarked_story_ids"]

    def test_limit_check(self, session, user_id):
        r = session.get(f"{API}/user/{user_id}/limit-check", timeout=15)
        assert r.status_code == 200
        data = r.json()
        for k in ("credits", "capacity", "recharge_seconds", "is_premium"):
            assert k in data


# --- premium placeholder & profile ----------------------------------------
class TestProfile:
    def test_set_profile(self, session, user_id):
        r = session.post(f"{API}/user/profile",
                         json={"user_id": user_id, "display_name": "TEST_Mario",
                               "gender": "man", "age": 30}, timeout=15)
        assert r.status_code == 200
        state = r.json()
        assert state["display_name"] == "TEST_Mario"
        assert state["age"] == 30


# --- cleanup ---------------------------------------------------------------
@pytest.fixture(scope="module", autouse=True)
def cleanup_after(user_id):
    yield
    # best-effort cleanup via mongo
    try:
        from pymongo import MongoClient
        c = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        c[os.environ.get("DB_NAME", "test_database")].user_state.delete_one({"user_id": user_id})
    except Exception:
        pass
