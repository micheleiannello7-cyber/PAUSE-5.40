"""Prova di stile per le nuove icone 3D delle categorie (una tantum).
Genera tre fogli 2×2 con gli stessi quattro soggetti, uno per stile.
Uso: cd backend && python gen_icon_styles.py
"""
import asyncio, base64, os
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv(Path(__file__).parent / ".env")
OUT = Path(__file__).parent / "category_art" / "style-tests"
OUT.mkdir(exist_ok=True)

SUBJECTS = ("top-left: a laboratory flask (Science); top-right: the planet Saturn with rings (Space); "
            "bottom-left: a computer microchip (Technology); bottom-right: an animal paw (Animals)")
BASE = ("A clean 2x2 grid of four separate 3D icons, each centered in its own square cell, on one uniform deep "
        "night-blue almost black background (#071226) with no cell borders, no text, no labels, no watermark. "
        f"Subjects: {SUBJECTS}. Each object is a single hero object, same scale, same lighting direction, "
        "same camera angle (slight 3/4 view from above), premium app-icon quality, 4k render, sharp. ")

STYLES = {
    "stile-1-vetro": BASE + "STYLE: frosted glass and polished crystal material, translucent, cool cyan and ice-blue "
                            "body with soft violet rim light from the left and cyan rim light from the right, subtle "
                            "internal glow, refined and minimal, strictly monochrome cyan/blue/violet palette, soft shadow underneath.",
    "stile-2-obsidiana": BASE + "STYLE: dark obsidian / brushed gunmetal objects with thin glowing cyan neon edge lines and "
                                "small luminous cyan details, elegant tech look, matte dark surfaces that catch cool highlights, "
                                "no bright colours except cyan accents, soft cyan floor glow under each object.",
    "stile-3-ologramma": BASE + "STYLE: translucent holographic volumes made of fine cyan light filaments and particles, "
                                "like a projected hologram, glowing from within, slight chromatic violet shift at edges, "
                                "ethereal and futuristic, soft bokeh particles, cohesive cyan palette.",
}


async def gen(name: str, prompt: str) -> None:
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"icon-style-{name}", system_message="You generate images.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    _, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if not images:
        print(f"[{name}] nessuna immagine"); return
    data = base64.b64decode(images[0]["data"])
    ext = "jpg" if "jpeg" in images[0]["mime_type"] else "png"
    (OUT / f"{name}.{ext}").write_bytes(data)
    print(f"[{name}] salvata ({len(data)//1024} KB)")


async def main() -> None:
    await asyncio.gather(*(gen(n, p) for n, p in STYLES.items()))


if __name__ == "__main__":
    asyncio.run(main())
