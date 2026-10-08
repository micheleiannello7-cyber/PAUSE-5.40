"""Genera le 4 foto atmosferiche per le card Premium (una tantum) con Nano Banana.
Uso: cd backend && python gen_premium_art.py
"""
import asyncio, base64, os, sys
from pathlib import Path
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv(Path(__file__).parent / ".env")
OUT = Path(__file__).resolve().parents[1] / "frontend" / "assets" / "images"

STYLE = ("Cinematic photograph, realistic, moody deep night-blue and near-black palette with subtle cyan highlights, "
         "soft volumetric light, shallow depth of field, premium editorial look. Landscape 16:10 framing. "
         "Absolutely no text, no letters, no logos, no watermarks, no UI elements.")

PROMPTS = {
    "premium-stories": "Dramatic mountain landscape at blue hour, mist in the valley, faint stars, cold cyan light on snowy peaks.",
    "premium-learn": "A glowing translucent human brain made of fine cyan light filaments and particles floating in dark space, bokeh.",
    "premium-audio": "Premium over-ear headphones resting on a dark surface, rim-lit with soft cyan and violet light, dark background.",
    "premium-personal": "Silhouette of a person seen from behind standing before a vast landscape at sunset, warm orange horizon fading into deep blue night sky.",
    "premium-bg-streak": "Abstract background: pure deep navy blue almost black (#071226) uniform backdrop, with two or three very thin elegant curved cyan light streaks sweeping diagonally from lower-left to upper-right along the right side, soft glow and subtle bokeh particles, minimal, lots of empty dark space on the left. Portrait 9:16.",
    "premium-bg-horizon": "Wide mountain landscape at dusk seen from above the clouds: dark silhouetted ridges, soft cyan-blue aurora glow and a thin warm light on the horizon, deep navy-blue night sky filling the upper half fading to almost black at the top, faint stars. Wide 16:9.",
}


async def gen(name: str, prompt: str) -> None:
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"premium-art-{name}", system_message="You generate images.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
    _, images = await chat.send_message_multimodal_response(UserMessage(text=f"{prompt} {STYLE}"))
    if not images:
        print(f"[{name}] nessuna immagine")
        return
    data = base64.b64decode(images[0]["data"])
    ext = "jpg" if "jpeg" in images[0]["mime_type"] else "png"
    path = OUT / f"{name}.{ext}"
    path.write_bytes(data)
    print(f"[{name}] salvata {path} ({len(data)//1024} KB)")


async def main() -> None:
    names = sys.argv[1:] or list(PROMPTS)
    for n in names:
        await gen(n, PROMPTS[n])


if __name__ == "__main__":
    asyncio.run(main())
