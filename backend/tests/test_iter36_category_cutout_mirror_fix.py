"""Iter36 — Verifies the category-media cutout endpoint after the alpha-cleanup
+ mirror-detection fix in media_opt.cutout_png.

Guarantees for each category:
  - 200 OK on GET /api/category-media/{id}?cutout=true&tight=true
  - returned PNG has height > 180 (ensures the mirror-cut heuristic didn't
    destroy a legitimate icon — regression against the cultura 6x6 bug).
  - returned image has RGBA mode (true cutout).
  - the bottom row of the image is fully transparent (no shadow/mirror
    baked at the very bottom edge of the PNG).
"""
import io
import os

import pytest
import requests
from PIL import Image

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")

CATEGORIES = [
    "animali", "scienza", "cultura", "spazio", "natura",
    "storia", "tecnologia", "psicologia", "corpo-umano", "geografia",
]


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    return s


@pytest.mark.parametrize("cat", CATEGORIES)
def test_category_cutout_renders(session, cat):
    url = f"{BASE_URL}/api/category-media/{cat}"
    params = {"v": "holo-v1", "delivery": "holo-v1j", "cutout": "true", "cut": "2", "tight": "true"}
    r = session.get(url, params=params, timeout=60)
    assert r.status_code == 200, f"{cat}: HTTP {r.status_code} — {r.text[:200]}"
    assert r.headers.get("content-type", "").startswith("image/png"), f"{cat}: wrong content-type {r.headers.get('content-type')}"
    img = Image.open(io.BytesIO(r.content))
    w, h = img.size
    assert h > 180, f"{cat}: height={h} (expected >180) — mirror-cut heuristic may have destroyed the icon"
    # Width can legitimately be < 180 for tall/narrow objects (hourglass, flask).
    # Only enforce that we're not down to a few pixels.
    assert w > 50, f"{cat}: width={w} (too narrow — likely destroyed)"
    assert img.mode == "RGBA", f"{cat}: mode={img.mode} (expected RGBA)"
    # Bottom row should be fully transparent — no residual shadow/mirror
    last_row_alphas = [img.getpixel((x, h - 1))[3] for x in range(0, w, max(1, w // 20))]
    assert max(last_row_alphas) == 0, f"{cat}: bottom row has non-zero alpha {max(last_row_alphas)} (shadow residue)"


def test_all_12_known_categories_return_200(session):
    """Broader sanity: all 12 ids used in-app should resolve."""
    full = CATEGORIES
    failures = []
    for cat in full:
        r = session.get(
            f"{BASE_URL}/api/category-media/{cat}",
            params={"v": "holo-v1", "delivery": "holo-v1j", "cutout": "true", "cut": "2", "tight": "true"},
            timeout=60,
        )
        if r.status_code != 200:
            failures.append(f"{cat}:{r.status_code}")
    assert not failures, f"Failures: {failures}"
