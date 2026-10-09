"""Icone di tema (Gemstone 3D · Carta): categorie + icone app + sfondo Carta.

Uso:  cd backend && python gen_theme_icons.py <gem|carta> [nome ...]
      nomi: cat-<id>, nomi icone app (vedi APP), "bg" (solo carta)
Out:  frontend/assets/images/<tema>/<nome>.png (RGBA 512, sfondo rimosso)
"""
import asyncio
import base64
import io
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

from PIL import Image, ImageOps  # noqa: E402
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # noqa: E402
from generate_pause_mark import fit_square  # noqa: E402
from gen_gem_icons import remove_black_bg, ref_on_black, ICONS as GEM_APP, BASE as GEM_BASE  # noqa: E402

MODEL = "gemini-3.1-flash-image-preview"
IMG = ROOT.parent / "frontend" / "assets" / "images"
REFS = ROOT.parent / "memory" / "refs"
RAW = ROOT.parent / "memory" / "icons_theme"

COMMON = ("Keep exactly the same subject, silhouette, proportions and camera angle as the FIRST reference image. "
          "Single object perfectly centred on a pure flat black (#000000) background, no floor, no reflection, "
          "no ground shadow, no text, no extra elements, square 1:1, object fills about 72% of the frame. "
          "High-end 4k product render. ")
STYLE = {
    "gem": ("Re-render the subject as a premium 3D GEMSTONE JEWEL icon: cut, faceted precious gemstones with crisp facets, "
            "brilliant refractions and sparkling highlights, set in thin polished liquid-gold edges and details. "),
    "carta": ("Re-render the subject as a premium 3D icon in the 'CARTA' style shown in the SECOND reference image: elegant, "
              "minimal, sophisticated. Matte ivory / cream / warm sand sculpted material with a subtle tactile paper-stone "
              "texture, combined with refined brushed and polished champagne-gold details. Neutral palette (ivory, sand, "
              "warm grey, champagne gold), soft warm studio light, timeless luxury look. "),
}
CARTA_BASE = ("INACTIVE state: the whole object in a muted matte warm-grey stone with dull pewter details, "
              "desaturated, no gold shine. ")

CAT_SUBJECT = {
    "gem": {
        "animali": "a paw print made of topaz amber and smoky citrine gems",
        "storia": "a classical column made of champagne topaz and pearl with gold capitals",
        "economia": "a stack of coins carved from citrine and emerald with gold rims",
        "natura": "leaves carved from emerald and peridot with gold veins",
        "geografia": "a globe of sapphire and aquamarine on a gold stand",
        "cultura": "the same subject in amethyst and rose quartz with gold",
        "scienza": "an atom of diamond and aquamarine with gold orbit rings",
        "tecnologia": "the same subject in sapphire and aquamarine with gold circuitry",
        "spazio": "a ringed planet of amethyst and sapphire with a diamond ring",
        "arte": "the same subject in ruby, sapphire and citrine gems with gold",
        "psicologia": "a brain carved from rose quartz and amethyst with gold details",
        "corpo-umano": "an anatomical heart carved from ruby with gold vessels",
        "all": "the same subject in aquamarine, amethyst and diamond with gold",
    },
    "carta": {
        "animali": "a majestic wolf head bust",
        "storia": "a classical Ionic column",
        "economia": "a small stack of coins with a large coin showing a dollar sign",
        "natura": "a sprig of three elegant leaves",
        "geografia": "a world globe on a meridian stand",
        "cultura": "an open book",
        "scienza": "an atom with orbit rings and a glowing gold nucleus",
        "tecnologia": "a microchip / processor block",
        "spazio": "a ringed planet like Saturn",
        "arte": "a sculptural ampersand (&) symbol",
        "psicologia": "a human brain",
        "corpo-umano": "an anatomical human heart",
        "all": "a sphere planet wrapped by a thin gold orbit ring",
    },
}

APP = {k: v for k, v in GEM_APP.items()}  # stessi riferimenti delle icone 3D (nome → (file ref, prompt gem))
CARTA_APP = {
    "kind-lesson": "a light bulb in ivory with a gold filament and gold screw base",
    "kind-bulb": "a stack of three books in ivory and sand with gold page edges",
    "kind-book": "an open book with ivory pages and gold edges",
    "kind-clock": "a round clock with sand case, ivory face, gold hands",
    "kind-headphones": "headphones in ivory with gold joints",
    "act-heart-active": "a heart in ivory with a gold rim",
    "act-heart-base": CARTA_BASE + "A heart.",
    "act-bookmark-active": "a bookmark ribbon in ivory with gold edges",
    "act-bookmark-base": CARTA_BASE + "A bookmark ribbon.",
    "act-share": "a share symbol (box with upward arrow) in ivory with gold arrow",
    "nav-home-active": "a small house in ivory with a gold roof",
    "nav-home-base": CARTA_BASE + "A small house.",
    "nav-topics-active": "four rounded square tiles in a 2x2 grid, three ivory and one gold",
    "nav-topics-base": CARTA_BASE + "Four rounded square tiles in a 2x2 grid.",
    "nav-profile-active": "a person silhouette (head and shoulders) in ivory with gold edges",
    "nav-profile-base": CARTA_BASE + "A person silhouette (head and shoulders).",
}

BG_PROMPT = (
    "Recreate the BACKGROUND of the reference app screenshot as a clean full-bleed phone wallpaper with NO user interface, "
    "NO text, NO icons, NO buttons, NO cards: deep midnight navy-black space, a large softly glowing golden planet "
    "horizon arc partially visible at the top right edge, fine golden stardust, and elegant flowing sand / cream silk "
    "dune waves sweeping diagonally through the middle and bottom. Elegant, minimal, sophisticated, neutral palette "
    "(navy black, ivory, sand, champagne gold). Dark overall so white text stays readable. Portrait 9:16, 4k."
)


def b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def job(theme: str, name: str):
    """→ (prompt, [refs], is_background)"""
    style_ref = [ImageContent(b64(REFS / "carta_grid.png"))] if theme == "carta" else []
    if name == "bg":
        return BG_PROMPT, [ImageContent(b64(REFS / "carta_ref.png"))], True
    if name.startswith("cat-"):
        cid = name[4:]
        subject = CAT_SUBJECT[theme][cid]
        prompt = STYLE[theme] + COMMON + f"Subject: {subject}."
        return prompt, [ImageContent(ref_on_black(REFS / "holo" / f"{cid}.png"))] + style_ref, False
    ref_file, gem_prompt = APP[name]
    if theme == "gem":
        prompt = STYLE["gem"] + COMMON + gem_prompt
    else:
        p = CARTA_APP[name]
        prompt = STYLE["carta"] + COMMON + (p if p.startswith("INACTIVE") else f"Subject: {p}.")
    return prompt, [ImageContent(ref_on_black(IMG / ref_file))] + style_ref, False


async def generate(theme: str, name: str) -> None:
    prompt, refs, is_bg = job(theme, name)
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"{theme}-{name}",
                   system_message="You are a world-class 3D icon and wallpaper artist.").with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt, file_contents=refs))
    if not images:
        raise RuntimeError("no image")
    raw = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(images[0]["data"])))).convert("RGB")
    out_dir = IMG / theme
    RAW.mkdir(parents=True, exist_ok=True)
    out_dir.mkdir(parents=True, exist_ok=True)
    raw.save(RAW / f"{theme}-{name}.raw.png")
    if is_bg:
        w, h = raw.size
        tw = int(h * 9 / 16)
        if tw < w:
            raw = raw.crop(((w - tw) // 2, 0, (w - tw) // 2 + tw, h))
        raw.resize((1080, 1920), Image.LANCZOS).save(out_dir / "bg.jpg", "JPEG", quality=86, optimize=True)
    else:
        fit_square(remove_black_bg(raw), size=512, margin=0.04).save(out_dir / f"{name}.png", "PNG", optimize=True)
    print("saved", theme, name, flush=True)


def all_names(theme: str):
    names = [f"cat-{c}" for c in CAT_SUBJECT[theme]]
    if theme == "carta":
        names += list(CARTA_APP) + ["bg"]
    return names


async def main():
    theme = sys.argv[1]
    names = sys.argv[2:] or all_names(theme)
    sem = asyncio.Semaphore(4)

    async def run(n):
        async with sem:
            for attempt in range(2):
                try:
                    await generate(theme, n)
                    return
                except Exception as exc:  # noqa: BLE001
                    print("FAILED", theme, n, attempt, str(exc)[:160], flush=True)
    await asyncio.gather(*(run(n) for n in names))


if __name__ == "__main__":
    asyncio.run(main())
