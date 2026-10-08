# PAUSE iter2 — Collection endpoint tests
import os, uuid, requests, pytest

BASE_URL = os.environ.get("EXPO_BACKEND_URL") or "https://ciao-chat-478.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def user_id():
    return f"TEST_coll_{uuid.uuid4().hex[:8]}"


def _get(path):
    r = requests.get(f"{BASE_URL}{path}", timeout=30)
    return r


def test_collection_initial_shape(user_id):
    r = _get(f"/api/user/{user_id}/collection?lang=it")
    assert r.status_code == 200
    data = r.json()
    assert set(data.keys()) >= {"total", "unlocked", "categories"}
    assert isinstance(data["categories"], list)
    assert data["unlocked"] == 0
    # Each group must have required fields
    for g in data["categories"]:
        assert set(g.keys()) >= {"id", "name", "color", "total", "unlocked", "stories", "locked_ids"}
        assert isinstance(g["stories"], list)
        assert isinstance(g["locked_ids"], list)
        # No lesson in groups (collection excludes lessons via query kind!=lesson)
        for s in g["stories"]:
            assert s.get("kind", "story") != "lesson"


def test_complete_adds_story_to_collection(user_id):
    # Get a story id (free user: outside early-access window) by listing
    r = requests.get(f"{BASE_URL}/api/stories?limit=50&user_id={user_id}", timeout=30)
    assert r.status_code == 200
    stories = r.json()
    assert len(stories) > 0
    story = stories[0]
    story_id, cat_id = story["id"], story["category_id"]

    # Complete the story
    r = requests.post(f"{BASE_URL}/api/user/complete",
                      json={"user_id": user_id, "story_id": story_id, "minutes": 2}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert story_id in body.get("completed_story_ids", [])

    # Collection must now include this story
    r = _get(f"/api/user/{user_id}/collection?lang=it")
    assert r.status_code == 200
    data = r.json()
    assert data["unlocked"] >= 1
    group = next((g for g in data["categories"] if g["id"] == cat_id), None)
    assert group is not None, f"category {cat_id} missing in collection"
    unlocked_ids = [s["id"] for s in group["stories"]]
    assert story_id in unlocked_ids
    assert story_id not in group["locked_ids"]
    assert group["unlocked"] >= 1


def test_lessons_excluded_from_collection(user_id):
    r = _get(f"/api/user/{user_id}/collection?lang=it")
    assert r.status_code == 200
    for g in r.json()["categories"]:
        for s in g["stories"]:
            assert s.get("kind", "story") != "lesson"
