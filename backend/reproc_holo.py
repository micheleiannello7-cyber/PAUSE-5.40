"""Riprocessa SOLO alcune icone ologramma dai PNG grezzi già salvati (niente
costo LLM): ritaglio automatico sull'oggetto luminoso (fondo nero) + riempimento
costante + vignette, così le proporzioni combaciano con le altre. Poi upload +
aggiorna import-report.json. Infine lanciare publish_holograms.py.

    python reproc_holo.py arte corpo-umano geografia psicologia scienza
"""
import hashlib
import io
import json
import sys
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from PIL import Image, ImageEnhance

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
from storage import put_object  # noqa: E402
VERSION = "holo-v1"
RAW_DIR = ROOT / "category_art" / VERSION / "raw"
OUT_DIR = ROOT / "category_art" / VERSION
REPORT_PATH = OUT_DIR / "import-report.json"
TARGET_FILL = 340  # lato lungo dell'oggetto dentro il frame 480 (~71%): icone più grandi nel container
SATURATION = 1.5   # colori più vivi mantenendo il glow olografico


def _crop_to_object(image: Image.Image) -> Image.Image:
    gray = np.asarray(image.convert("L"), dtype=float)
    mask = gray > 38  # ignora il near-black e il pulviscolo debolissimo
    ys, xs = np.where(mask)
    if len(xs) == 0:
        return image
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    return image.crop((x0, y0, x1 + 1, y1 + 1))


def _postprocess(raw_rgb: Image.Image) -> bytes:
    obj = _crop_to_object(raw_rgb.convert("RGB"))
    obj = ImageEnhance.Color(obj).enhance(SATURATION)
    w, h = obj.size
    scale = TARGET_FILL / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    obj = obj.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (480, 480), (0, 0, 0))
    canvas.paste(obj, ((480 - nw) // 2, (480 - nh) // 2))
    pixels = np.asarray(canvas, dtype=float)
    y, x = np.mgrid[:480, :480]
    distance = np.minimum.reduce([x, y, 479 - x, 479 - y])
    opacity = np.clip(distance / 32, 0, 1)
    opacity = (opacity * opacity * (3 - 2 * opacity))[..., None]
    pixels = pixels * opacity + np.array([4, 10, 20]) * (1 - opacity)
    buf = io.BytesIO()
    Image.fromarray(pixels.astype("uint8")).save(buf, "WEBP", quality=94, method=6)
    return buf.getvalue()


def main() -> None:
    report = json.loads(REPORT_PATH.read_text())
    for cid in sys.argv[1:]:
        raw = Image.open(RAW_DIR / f"{cid}.png")
        content = _postprocess(raw)
        digest = hashlib.sha256(content).hexdigest()[:12]
        path = f"pause/category/{VERSION}/{cid}-{digest}.webp"
        result = put_object(path, content, "image/webp")
        report["artworks"][cid] = result["path"]
        (OUT_DIR / f"{cid}.webp").write_bytes(content)
        print(f"OK {cid}: {result['path']} ({len(content)} bytes)", flush=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")


if __name__ == "__main__":
    main()
