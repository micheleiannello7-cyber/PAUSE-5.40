"""Tema icone "Gemstone 3D": re-render delle icone 3D dell'app (stessi soggetti)
come gioielli sfaccettati. Usa l'icona 3D esistente come riferimento di forma.

Uso:  cd backend && python gen_gem_icons.py [nome ...]
Out:  frontend/assets/images/gem/<nome>.png (RGBA 512, sfondo rimosso)
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

from PIL import Image, ImageDraw, ImageFilter, ImageOps  # noqa: E402
from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # noqa: E402
from generate_pause_mark import fit_square  # noqa: E402

MODEL = "gemini-3.1-flash-image-preview"
IMG = ROOT.parent / "frontend" / "assets" / "images"
OUT = IMG / "gem"
RAW = ROOT.parent / "memory" / "icons_gem"

STYLE = (
    "Re-render the object shown in the reference image as a premium 3D GEMSTONE JEWEL app icon. "
    "Keep exactly the same object, silhouette, proportions and camera angle as the reference, but make it out of "
    "cut, faceted precious gemstones with crisp sharp facets, brilliant internal refractions and sparkling specular "
    "highlights, set in thin polished liquid-gold metal edges and details. Luxurious jewellery look, studio lighting, "
    "high-end 4k render. Single object perfectly centred on a pure flat black (#000000) background, no floor, "
    "no reflection, no ground shadow, no text, no extra elements, square 1:1, object fills about 70% of the frame. "
)
ACTIVE = "Gem colours: "
BASE = ("INACTIVE state: make the whole object in colourless smoky grey crystal / clear quartz with silver metal "
        "edges (desaturated, soft lavender-grey), still faceted and sparkling but without saturated colour. ")

ICONS = {
    "kind-lesson": ("kind-lesson.png", ACTIVE + "stacked books in sapphire blue, teal tourmaline and amethyst, gold page edges."),
    "kind-bulb": ("kind-bulb.png", ACTIVE + "a bulb of clear diamond crystal with a glowing amber citrine filament and a gold screw base."),
    "kind-book": ("kind-book.png", ACTIVE + "open book with pale champagne topaz pages and an emerald-teal cover, gold edges."),
    "kind-clock": ("kind-clock.png", ACTIVE + "amethyst purple case, mother-of-pearl face, gold hands and gold crown button."),
    "kind-headphones": ("kind-headphones.png", ACTIVE + "amethyst headband, ruby-coral ear cups, gold joints."),
    "act-heart-active": ("act-heart-active.png", ACTIVE + "a brilliant faceted ruby red heart with a thin gold rim."),
    "act-heart-base": ("act-heart-base.png", BASE + "A faceted heart."),
    "act-bookmark-active": ("act-bookmark-active.png", ACTIVE + "a faceted aquamarine / cyan topaz bookmark ribbon with gold edges."),
    "act-bookmark-base": ("act-bookmark-base.png", BASE + "A faceted bookmark ribbon."),
    "act-share": ("act-share-v2.png", ACTIVE + "aquamarine cyan crystal share symbol (box with an upward arrow) with gold edges."),
    "nav-home-active": ("nav-home-active.png", ACTIVE + "aquamarine walls, amethyst roof, amethyst door, gold trims."),
    "nav-home-base": ("nav-home-base.png", BASE + "A small house."),
    "nav-topics-active": ("nav-topics-active.png", ACTIVE + "four square cut gems in a 2x2 grid: three aquamarine and one amethyst, gold bezels."),
    "nav-topics-base": ("nav-topics-base.png", BASE + "Four square cut gems in a 2x2 grid."),
    "nav-profile-active": ("nav-profile-active.png", ACTIVE + "aquamarine cyan person silhouette (head and shoulders) with gold edges."),
    "nav-profile-base": ("nav-profile-base.png", BASE + "A person silhouette (head and shoulders)."),
}


def ref_on_black(path: Path) -> str:
    src = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", src.size, (0, 0, 0, 255))
    bg.alpha_composite(src)
    buf = io.BytesIO()
    bg.convert("RGB").save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def remove_black_bg(img: Image.Image) -> Image.Image:
    """Flood-fill from the borders over near-black pixels → transparent; keeps dark facets inside."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    dark = rgb.point(lambda v: 255 if v < 28 else 0).convert("L")
    # pixel "scuro" solo se tutti e tre i canali sono bassi
    r, g, b = [c.point(lambda v: 255 if v < 28 else 0) for c in rgb.split()]
    dark = Image.eval(Image.merge("RGB", (r, g, b)).convert("L"), lambda v: 255 if v > 250 else 0)
    for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]:
        if dark.getpixel(xy) == 255:
            ImageDraw.floodfill(dark, xy, 128)
    alpha = dark.point(lambda v: 0 if v == 128 else 255).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
    out = rgb.convert("RGBA")
    out.putalpha(alpha)
    return out


async def generate(name: str) -> None:
    ref, prompt = ICONS[name]
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"gem-{name}",
                   system_message="You are a world-class 3D jewellery icon artist.").with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    _, images = await chat.send_message_multimodal_response(
        UserMessage(text=STYLE + prompt, file_contents=[ImageContent(ref_on_black(IMG / ref))]))
    if not images:
        raise RuntimeError("no image")
    raw = ImageOps.exif_transpose(Image.open(io.BytesIO(base64.b64decode(images[0]["data"])))).convert("RGB")
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    raw.save(RAW / f"{name}.raw.png")
    fit_square(remove_black_bg(raw), size=512, margin=0.04).save(OUT / f"{name}.png", "PNG", optimize=True)
    print("saved", name, flush=True)


async def main():
    names = sys.argv[1:] or list(ICONS)
    sem = asyncio.Semaphore(4)

    async def run(n):
        async with sem:
            try:
                await generate(n)
            except Exception as exc:  # noqa: BLE001
                print("FAILED", n, exc, flush=True)
    await asyncio.gather(*(run(n) for n in names))


if __name__ == "__main__":
    asyncio.run(main())
