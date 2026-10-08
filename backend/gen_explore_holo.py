"""PAUSE — icona ESPLORA ("all") in stile ologramma holo-v1, ma con il
SOGGETTO e i COLORI dell'icona precedente (carte di vetro colorate a ventaglio
con il "?": blu-viola, teal, arancio-ambra su podio blu), usata come riferimento.

    cd backend && python gen_explore_holo.py           # genera + pubblica
    cd backend && python gen_explore_holo.py publish   # ripubblica l'ultimo PNG grezzo
"""
import asyncio
import base64
import hashlib
import io
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from PIL import Image, ImageOps

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
from gen_category_holograms import MODEL, OUT_DIR, RAW_DIR, REPORT_PATH, STYLE, VERSION  # noqa: E402
from reproc_holo import _postprocess  # noqa: E402
from storage import put_object  # noqa: E402

REF = ROOT / "category_art" / "all.webp"  # icona precedente (carte col "?")
MANIFEST_PATH = ROOT / "category_art_manifest.json"

SUBJECT = (
    "The hologram object is EXACTLY the object shown in the attached reference image, same composition, "
    "same shapes, same proportions, same camera angle: three translucent glass cards fanned out and standing "
    "upright — the front card with a large bold rounded question mark '?' in the middle, behind it a second "
    "card tilted right and a third card tilted further right, all standing on a rounded-square glowing glass "
    "podium with a luminous rim. Keep the SAME colour identity as the reference, just rendered as a glowing "
    "hologram: the front card glows blue-violet with a cyan-to-violet question mark, the middle card glows "
    "teal-cyan, the back card glows warm orange-amber, the podium glows deep blue with a soft neon-blue rim. "
    "Built from fine light filaments and luminous particles with a delicate internal wireframe, exactly like "
    "a holographic projection."
)


async def generate() -> Image.Image:
    from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage

    ref = Image.open(REF).convert("RGB")
    buf = io.BytesIO(); ref.save(buf, "PNG")
    ref_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    chat = (
        LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id="holo-all-cards",
                system_message="You are a world-class 3D holographic icon illustrator.")
        .with_model("gemini", MODEL).with_params(modalities=["image", "text"])
    )
    _, images = await chat.send_message_multimodal_response(
        UserMessage(text=STYLE + SUBJECT, file_contents=[ImageContent(ref_b64)]))
    if not images:
        raise RuntimeError("no image returned")
    raw = base64.b64decode(images[0]["data"])
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    image.save(RAW_DIR / "all.png")
    return image


async def publish(image: Image.Image) -> None:
    content = _postprocess(image)
    digest = hashlib.sha256(content).hexdigest()[:12]
    path = f"pause/category/{VERSION}/all-{digest}.webp"
    result = put_object(path, content, "image/webp")
    (OUT_DIR / "all.webp").write_bytes(content)
    report = json.loads(REPORT_PATH.read_text())
    report["artworks"]["all"] = result["path"]
    REPORT_PATH.write_text(json.dumps(report, indent=2) + "\n")
    manifest = json.loads(MANIFEST_PATH.read_text())
    manifest["artworks"]["all"] = result["path"]
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + "\n")
    from motor.motor_asyncio import AsyncIOMotorClient
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    await client[os.environ["DB_NAME"]].design_assets.update_one(
        {"id": "category-all"},
        {"$set": {"illustration_generated": result["path"], "illustration_revision": VERSION}}, upsert=True)
    client.close()
    print(f"OK all → {result['path']} ({len(content)} bytes)", flush=True)


async def main() -> None:
    if sys.argv[1:] == ["publish"]:
        image = Image.open(RAW_DIR / "all.png")
    else:
        image = await generate()
    await publish(image)


if __name__ == "__main__":
    asyncio.run(main())
