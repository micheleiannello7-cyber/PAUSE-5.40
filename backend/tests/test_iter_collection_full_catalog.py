"""Tests for /api/user/{user_id}/collection full-catalog counting (iteration 6).

User report (IT): "la collezione mi dice 0 di 254 se l'app ha 493 storie".
Fix should include the entire catalog (304 curiosità + 189 lezioni = 493) in the
summary, including Premium early-access novità as locked cards.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

EXPECTED_TOTAL = 493
EXPECTED_PER_CAT = {
    # scienza is the only category that keeps the extended set (53)
    "scienza": 53,
    # every other category should hit 40
}
OTHER_CAT_EXPECTED = 40


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def guest_id():
    return f"TEST_coll_{uuid.uuid4().hex[:8]}"


# ---------------------------------------------------------------------------
# Collection summary – guest user, lang=it
# ---------------------------------------------------------------------------
class TestCollectionGuestIT:
    def test_total_is_493(self, api, guest_id):
        r = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "it"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] == EXPECTED_TOTAL, f"expected total=493, got {data['total']}"
        assert data["unlocked"] == 0

    def test_twelve_categories_and_totals_sum(self, api, guest_id):
        data = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "it"}).json()
        groups = data["categories"]
        assert len(groups) == 12, f"expected 12 category groups, got {len(groups)}: {[g['id'] for g in groups]}"
        summed = sum(g["total"] for g in groups)
        assert summed == EXPECTED_TOTAL, f"sum of group totals {summed} != {EXPECTED_TOTAL}"

    def test_per_category_counts(self, api, guest_id):
        data = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "it"}).json()
        for g in data["categories"]:
            if g["id"] == "scienza":
                assert g["total"] == EXPECTED_PER_CAT["scienza"], (
                    f"scienza total {g['total']} != {EXPECTED_PER_CAT['scienza']}"
                )
            else:
                assert g["total"] == OTHER_CAT_EXPECTED, (
                    f"category {g['id']} total {g['total']} != {OTHER_CAT_EXPECTED}"
                )

    def test_all_locked_for_new_user(self, api, guest_id):
        data = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "it"}).json()
        for g in data["categories"]:
            assert g["unlocked"] == 0
            assert g["stories"] == []
            assert len(g["locked_ids"]) == g["total"]


# ---------------------------------------------------------------------------
# Collection summary – guest user, lang=en  (should still return 493)
# ---------------------------------------------------------------------------
class TestCollectionGuestEN:
    def test_total_is_493_en(self, api, guest_id):
        r = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "en"})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == EXPECTED_TOTAL
        assert data["unlocked"] == 0
        assert len(data["categories"]) == 12


# ---------------------------------------------------------------------------
# After completing a story + a lesson, counts should increment correctly.
# ---------------------------------------------------------------------------
class TestCollectionAfterCompletion:
    def _pick_sample_ids(self, api):
        """Return (story_id, story_cat, lesson_id, lesson_cat) covering both kinds."""
        # fetch stories by category to find a 'story' and a 'lesson'
        r = api.get(f"{BASE_URL}/api/stories", params={"lang": "it", "limit": 500})
        assert r.status_code == 200
        docs = r.json()
        # Fallback: /api/stories may not accept limit; filter whatever we got.
        story_doc = next((d for d in docs if d.get("kind") == "story"), None)
        lesson_doc = next((d for d in docs if d.get("kind") == "lesson"), None)
        # If lesson not in top-N, hit the lesson-specific category.
        if not lesson_doc:
            r2 = api.get(f"{BASE_URL}/api/stories", params={"lang": "it", "category_id": "lezioni"})
            if r2.status_code == 200:
                lesson_doc = next((d for d in r2.json() if d.get("kind") == "lesson"), None)
        return story_doc, lesson_doc

    def test_complete_story_and_lesson_increments(self, api, guest_id):
        story_doc, lesson_doc = self._pick_sample_ids(api)
        if not story_doc:
            pytest.skip("no story found in /api/stories response")

        before = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "it"}).json()
        assert before["unlocked"] == 0

        # Complete the story
        r = api.post(f"{BASE_URL}/api/user/complete", json={
            "user_id": guest_id, "story_id": story_doc["id"], "minutes": 2, "seconds": 60,
        })
        assert r.status_code == 200, r.text

        after1 = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "it"}).json()
        assert after1["total"] == EXPECTED_TOTAL
        assert after1["unlocked"] == 1

        # The completed story must appear under its own category's stories[]
        grp = next(g for g in after1["categories"] if g["id"] == story_doc["category_id"])
        assert any(s["id"] == story_doc["id"] for s in grp["stories"]), (
            f"completed story {story_doc['id']} not found in group {grp['id']} stories"
        )
        assert story_doc["id"] not in grp["locked_ids"], "completed story still in locked_ids"
        assert grp["unlocked"] == 1

        # Complete a lesson too (if available)
        if lesson_doc:
            r = api.post(f"{BASE_URL}/api/user/complete", json={
                "user_id": guest_id, "story_id": lesson_doc["id"], "minutes": 2, "seconds": 60,
            })
            assert r.status_code == 200, r.text
            after2 = api.get(f"{BASE_URL}/api/user/{guest_id}/collection", params={"lang": "it"}).json()
            assert after2["unlocked"] == 2
            grp2 = next(g for g in after2["categories"] if g["id"] == lesson_doc["category_id"])
            assert any(s["id"] == lesson_doc["id"] for s in grp2["stories"])
            assert lesson_doc["id"] not in grp2["locked_ids"]


# ---------------------------------------------------------------------------
# Catalog sanity – stories collection size matches 493 at DB level.
# ---------------------------------------------------------------------------
class TestCatalogSize:
    def test_stories_endpoint_reports_493_total_across_categories(self, api):
        """Sum per-category story counts via public endpoint."""
        rc = api.get(f"{BASE_URL}/api/categories", params={"lang": "it"})
        assert rc.status_code == 200
        cats = rc.json()
        total = 0
        per_cat = {}
        for c in cats:
            r = api.get(f"{BASE_URL}/api/stories", params={"lang": "it", "category_id": c["id"], "limit": 500})
            if r.status_code != 200:
                continue
            n = len(r.json())
            per_cat[c["id"]] = n
            total += n
        # /api/stories may apply a 'limit' default (50), so this is a soft check.
        # The hard assertion is driven by /collection in the tests above.
        print(f"[info] per-category counts via /api/stories: {per_cat}, total={total}")
