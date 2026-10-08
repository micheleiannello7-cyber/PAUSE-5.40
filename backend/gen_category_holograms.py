"""PAUSE — nuova famiglia di icone 3D "ologramma" per le categorie.

Scelta utente (26/06/2026): stile ologramma (vedi category_art/style-tests/
stile-3-ologramma.jpg), MA ogni categoria conserva la propria identità cromatica
(scienza ciano, spazio blu/viola, natura verde, arte arancio/rosa, corpo-umano
rosso/corallo, ...). Il COLORE dell'oggetto = identità della categoria e NON
cambia col tema; il tema PAUSE guida solo l'atmosfera UI (sfondi, bordi, glow,
nav). Colori eleganti, mai fluo/sgargianti. Stessa famiglia visiva: stesso
realismo 3D, stessa illuminazione, bordi morbidi, look premium.

Pipeline (identica a import_reference_categories.py, così la pipeline di
serving + cutout esistente funziona invariata):
  genera 1024px su fondo NERO → RGB → resize 480 → vignette dei bordi verso il
  near-black delle tile → WebP q94 → Object Storage pause/category/holo-v1/.

È RIPETIBILE / RIPRENDIBILE: le categorie già presenti in
category_art/holo-v1/import-report.json vengono saltate. Se il budget della
chiave si esaurisce, basta rilanciarlo per continuare da dove si era fermato:

    cd backend && python gen_category_holograms.py            # tutte le mancanti
    cd backend && python gen_category_holograms.py arte spazio # solo alcune

Dopo che TUTTE e 13 sono generate, pubblica con:  python publish_holograms.py
"""
import asyncio
import base64
import hashlib
import io
import json
import os
import sys
from pathlib import Path

import numpy as np
from dotenv import load_dotenv
from PIL import Image, ImageOps

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from storage import put_object  # noqa: E402

MODEL = "gemini-3.1-flash-image-preview"
VERSION = "holo-v1"
RAW_DIR = ROOT / "category_art" / VERSION / "raw"
OUT_DIR = ROOT / "category_art" / VERSION
REPORT_PATH = OUT_DIR / "import-report.json"

# Stile ologramma condiviso da TUTTE le categorie (coerenza di famiglia).
# Fondo NERO puro: si fonde con le tile scure e permette il keying del cutout.
STYLE = (
    "A single premium 3D app icon rendered as a translucent HOLOGRAM: the object is "
    "built from fine glowing light filaments and tiny luminous particles, like a volumetric "
    "projected hologram glowing softly from within, with delicate internal wireframe structure, "
    "gentle bokeh sparkles around it and a subtle soft reflection/glow on the ground. "
    "Slight 3/4 view from above, elegant and futuristic, soft edges, high depth, 4k render, sharp, "
    "premium app-icon quality. The object is perfectly centred on a PURE BLACK (#000000) background "
    "with a generous black margin (object fills about 62% of the frame). No text, no labels, no "
    "watermark, no frame, no floor grid, no extra objects. "
    "IMPORTANT colour rule: the hologram glows in a refined, slightly desaturated, PREMIUM palette — "
    "elegant and calm, NEVER neon, NEVER garish, NEVER oversaturated. "
)

# soggetto (coerente con la famiglia reference-3d-v6 attuale) + direzione cromatica propria.
CATEGORIES = {
    "scienza":     ("a laboratory Erlenmeyer flask with a little liquid and a few rising bubbles",
                    "cool cyan and ice-blue light"),
    "spazio":      ("a ringed planet like Saturn with a softly tilted ring system and a few distant stars",
                    "deep indigo-blue shifting to soft violet light"),
    "tecnologia":  ("a square microchip with short pins on all four sides and a smaller square core",
                    "electric blue to cyan light"),
    "natura":      ("a young sprig with three rounded leaves on a short stem",
                    "fresh emerald and mint green light"),
    "animali":     ("a single animal paw print with four toe pads and one main pad",
                    "warm amber-gold light with a faint green undertone"),
    "storia":      ("a classical Greek column with a simple capital and base",
                    "warm beige and antique-gold light"),
    "psicologia":  ("a human head in profile with a smooth stylised brain inside",
                    "soft rose-magenta light"),
    "corpo-umano": ("a stylised anatomical human heart with two short vessels on top",
                    "warm coral-red light"),
    "cultura":     ("an open book with softly curved pages seen from a three-quarter front angle",
                    "calm teal and aqua light"),
    "economia":    ("a neat stack of three thick coins with a simple embossed circle on top",
                    "rich warm gold light"),
    "arte":        ("a painter's palette with a thumb hole and a few small round paint dabs",
                    "soft orange blending into gentle pink light"),
    "geografia":   ("a desk globe on a small curved stand showing simplified continents",
                    "teal-blue shifting to soft green light"),
    "all":         ("a faceted multi-faceted crystal prism / gem catching light, symbol of discovery",
                    "a prismatic blend of soft blue and violet light"),
}


def _load_report() -> dict:
    if REPORT_PATH.exists():
        return json.loads(REPORT_PATH.read_text())
    return {"version": VERSION, "artworks": {}}


def _postprocess(raw_rgb: Image.Image) -> bytes:
    """pad a quadrato (preserva le proporzioni) + resize 480 + vignette dei bordi
    verso near-black (come reference-3d-v6). Il pad evita che immagini non quadrate
    (il modello a volte rende 1408x768) vengano schiacciate/stirate."""
    image = ImageOps.pad(raw_rgb.convert("RGB"), (480, 480), method=Image.Resampling.LANCZOS, color=(0, 0, 0), centering=(0.5, 0.5))
    pixels = np.asarray(image, dtype=float)
    y, x = np.mgrid[:480, :480]
    distance = np.minimum.reduce([x, y, 479 - x, 479 - y])
    opacity = np.clip(distance / 32, 0, 1)
    opacity = (opacity * opacity * (3 - 2 * opacity))[..., None]
    pixels = pixels * opacity + np.array([4, 10, 20]) * (1 - opacity)
    buf = io.BytesIO()
    Image.fromarray(pixels.astype("uint8")).save(buf, "WEBP", quality=94, method=6)
    return buf.getvalue()


async def generate(cid: str) -> bytes:
    subject, colour = CATEGORIES[cid]
    prompt = STYLE + f"The hologram object is {subject}, glowing in {colour}."
    chat = (
        LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"holo-{cid}",
                system_message="You are a world-class 3D holographic icon illustrator.")
        .with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    )
    _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if not images:
        raise RuntimeError(f"no image returned for {cid}")
    raw = base64.b64decode(images[0]["data"])
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    image.save(RAW_DIR / f"{cid}.png")
    return _postprocess(image)


async def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    report = _load_report()
    todo = [c for c in (sys.argv[1:] or list(CATEGORIES)) if c not in report["artworks"]]
    if not todo:
        print("tutte le categorie sono già generate:", list(report["artworks"]), flush=True)
        return
    print("da generare:", todo, flush=True)
    for cid in todo:
        try:
            content = await generate(cid)
            digest = hashlib.sha256(content).hexdigest()[:12]
            path = f"pause/category/{VERSION}/{cid}-{digest}.webp"
            result = put_object(path, content, "image/webp")
            report["artworks"][cid] = result["path"]
            (OUT_DIR / f"{cid}.webp").write_bytes(content)
            REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")
            print(f"OK {cid}: {result['path']} ({len(content)} bytes)", flush=True)
        except Exception as exc:  # noqa: BLE001 — continua e salva il progresso
            print(f"FAILED {cid}: {exc}", flush=True)
    done = list(report["artworks"])
    print(f"\nfatte {len(done)}/13: {done}", flush=True)
    missing = [c for c in CATEGORIES if c not in report["artworks"]]
    if missing:
        print(f"mancano ancora: {missing} — rilancia lo script per continuare.", flush=True)
    else:
        print("TUTTE generate. Ora esegui: python publish_holograms.py", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
