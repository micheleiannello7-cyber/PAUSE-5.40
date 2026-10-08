"""Backend tests for Profile Avatar feature (POST/GET/DELETE /api/user/avatar).

Covers success + validation paths called out in the review request. The
preview ingress returns 403 for non-browser clients without a User-Agent,
so a browser-like UA is set on all requests.
"""
import base64
import io
import os
import uuid

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL (or EXPO_BACKEND_URL) must be set"
BASE_URL = BASE_URL.rstrip("/")

UA = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    "Content-Type": "application/json",
}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update(UA)
    return s


@pytest.fixture(scope="module")
def small_jpeg_b64() -> str:
    img = Image.new("RGB", (64, 64), (255, 128, 32))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=70)
    return base64.b64encode(buf.getvalue()).decode()


@pytest.fixture(scope="module")
def user_id(session) -> str:
    uid = f"TEST_avatar_{uuid.uuid4().hex[:10]}"
    # Prime state
    r = session.get(f"{BASE_URL}/api/user/{uid}")
    assert r.status_code == 200, r.text
    yield uid
    # Cleanup
    try:
        session.delete(f"{BASE_URL}/api/user/{uid}/avatar")
    except Exception:
        pass


class TestAvatar:
    def test_health(self, session):
        r = session.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json().get("db") is True

    def test_initial_user_has_no_avatar(self, session, user_id):
        r = session.get(f"{BASE_URL}/api/user/{user_id}")
        assert r.status_code == 200
        body = r.json()
        assert "avatar_path" in body
        assert "avatar_version" in body
        assert body["avatar_path"] in (None, "")
        assert body["avatar_version"] in (None, "")

    def test_get_avatar_before_upload_is_404(self, session, user_id):
        r = session.get(f"{BASE_URL}/api/avatar/{user_id}")
        assert r.status_code == 404

    def test_upload_avatar_sets_fields(self, session, user_id, small_jpeg_b64):
        r = session.post(
            f"{BASE_URL}/api/user/avatar",
            json={"user_id": user_id, "image_base64": small_jpeg_b64},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["user_id"] == user_id
        assert body["avatar_path"], "avatar_path should be set"
        assert body["avatar_version"], "avatar_version should be set"
        assert "/avatar/" in body["avatar_path"]

    def test_get_user_includes_avatar_fields(self, session, user_id):
        r = session.get(f"{BASE_URL}/api/user/{user_id}")
        assert r.status_code == 200
        body = r.json()
        assert body.get("avatar_path")
        assert body.get("avatar_version")

    def test_get_avatar_returns_webp_with_etag(self, session, user_id):
        # Fetch current avatar_version via user doc
        u = session.get(f"{BASE_URL}/api/user/{user_id}").json()
        v = u["avatar_version"]
        r = session.get(f"{BASE_URL}/api/avatar/{user_id}?v={v}")
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("image/webp")
        etag = r.headers.get("etag") or r.headers.get("ETag")
        assert etag, "missing ETag"
        assert len(r.content) > 100

        # Conditional request → 304
        r2 = session.get(
            f"{BASE_URL}/api/avatar/{user_id}?v={v}",
            headers={**UA, "If-None-Match": etag},
        )
        assert r2.status_code == 304

    def test_upload_invalid_base64_returns_422(self, session, user_id):
        r = session.post(
            f"{BASE_URL}/api/user/avatar",
            json={"user_id": user_id, "image_base64": "!!!not-base-64!!!"},
        )
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"

    def test_delete_avatar_clears_fields_and_returns_404_after(self, session, user_id, small_jpeg_b64):
        # Ensure there is an avatar first
        up = session.post(
            f"{BASE_URL}/api/user/avatar",
            json={"user_id": user_id, "image_base64": small_jpeg_b64},
        )
        assert up.status_code == 200

        r = session.delete(f"{BASE_URL}/api/user/{user_id}/avatar")
        assert r.status_code == 200
        body = r.json()
        assert body.get("avatar_path") in (None, "")
        assert body.get("avatar_version") in (None, "")

        g = session.get(f"{BASE_URL}/api/avatar/{user_id}")
        assert g.status_code == 404

    def test_regression_premium_screen_route(self, session):
        # The /premium route is a frontend screen; backend still exposes
        # /api/user/premium (toggle). Verify set-premium works.
        uid = f"TEST_prem_{uuid.uuid4().hex[:8]}"
        r = session.post(
            f"{BASE_URL}/api/user/premium",
            json={"user_id": uid, "active": True},
        )
        assert r.status_code == 200
        assert r.json().get("is_premium") is True
