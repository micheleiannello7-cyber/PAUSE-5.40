"""Smoke tests after GitHub import — verifies the core PAUSE endpoints
used by onboarding/home/reader flows."""
import os
import pytest
import requests

BASE_URL = os.environ['EXPO_PUBLIC_BACKEND_URL'].rstrip('/')
TIMEOUT = 15


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Health & categories -------------------------------------------------
def test_health(api):
    r = api.get(f"{BASE_URL}/api/health", timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in ("ok", "degraded")
    assert body["db"] is True


def test_categories_returns_12(api):
    r = api.get(f"{BASE_URL}/api/categories", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 12
    expected = {"corpo-umano", "animali", "storia", "economia", "natura",
                "geografia", "cultura", "scienza", "tecnologia", "spazio",
                "arte", "psicologia"}
    assert {c["id"] for c in data} == expected
    for c in data:
        assert c["story_count"] >= 0
        assert c["color"].startswith("#")


def test_categories_en_locale(api):
    r = api.get(f"{BASE_URL}/api/categories?lang=en", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 12


# --- Stories list / detail ----------------------------------------------
def test_stories_list(api):
    r = api.get(f"{BASE_URL}/api/stories?limit=5", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "id" in data[0] and "title" in data[0] and "category_id" in data[0]


def test_stories_filter_by_category(api):
    r = api.get(f"{BASE_URL}/api/stories?category_id=scienza&limit=5", timeout=TIMEOUT)
    assert r.status_code == 200
    data = r.json()
    assert len(data) > 0
    assert all(s["category_id"] == "scienza" for s in data)


def test_story_detail_has_chapters(api):
    lst = api.get(f"{BASE_URL}/api/stories?limit=1", timeout=TIMEOUT).json()
    assert lst, "no stories"
    sid = lst[0]["id"]
    r = api.get(f"{BASE_URL}/api/stories/{sid}", timeout=TIMEOUT)
    assert r.status_code == 200
    detail = r.json()
    assert detail["id"] == sid
    assert isinstance(detail["chapters"], list) and len(detail["chapters"]) > 0
    ch = detail["chapters"][0]
    for k in ("number", "title", "body"):
        assert k in ch


def test_story_404(api):
    r = api.get(f"{BASE_URL}/api/stories/does-not-exist-xyz", timeout=TIMEOUT)
    assert r.status_code == 404


# --- Guest user flow -----------------------------------------------------
GUEST_ID = "TEST_guest_smoke_import"


def test_guest_user_autocreate(api):
    r = api.get(f"{BASE_URL}/api/user/{GUEST_ID}", timeout=TIMEOUT)
    assert r.status_code == 200
    assert r.json()["user_id"] == GUEST_ID


def test_guest_set_interests_and_discover(api):
    r = api.post(f"{BASE_URL}/api/user/interests",
                 json={"user_id": GUEST_ID, "interests": ["scienza", "spazio"]},
                 timeout=TIMEOUT)
    assert r.status_code == 200
    assert set(r.json()["interests"]) == {"scienza", "spazio"}

    r = api.get(f"{BASE_URL}/api/discover-batch",
                params={"user_id": GUEST_ID, "interests": "scienza,spazio", "count": 5},
                timeout=TIMEOUT)
    assert r.status_code == 200
    assert len(r.json()) > 0


def test_bookmarks_endpoint(api):
    r = api.get(f"{BASE_URL}/api/user/{GUEST_ID}/bookmarks", timeout=TIMEOUT)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_limit_check(api):
    r = api.get(f"{BASE_URL}/api/user/{GUEST_ID}/limit-check", timeout=TIMEOUT)
    assert r.status_code == 200
    body = r.json()
    assert "credits" in body and "capacity" in body
