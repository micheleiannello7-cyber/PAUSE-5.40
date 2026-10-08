"""PAUSE — rimuove le bande nere "letterbox" cotte dentro alcune copertine AI.

Alcune copertine generate hanno una banda nera piena in alto/in basso: con
`contentFit:cover` la banda grande resta visibile (card "tagliata"). Qui la
rileviamo (righe quasi pure nere e uniformi) e la ritagliamo via. NESSUNA
generazione AI: pura elaborazione immagine, costo zero.

Uso (da backend/):
    python fix_letterbox.py scan                 # elenca le copertine con banda
    python fix_letterbox.py fix --only id,id     # ritaglia solo quelle
    python fix_letterbox.py fix [--limit N]       # ritaglia tutte le candidate
    python fix_letterbox.py restore <id>          # ripristina l'originale

Backup master originale in covers_backup_pre_letterbox/.
"""
import argparse
import asyncio
import io
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from PIL import Image

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from media_opt import upload_cover  # noqa: E402

COVERS = ROOT / "covers"
BACKUP = ROOT / "covers_backup_pre_letterbox"
# Una riga è "banda nera" se quasi pura nera e uniforme (no stelle/gradiente).
ROW_MEAN_MAX = 16.0
ROW_STD_MAX = 12.0
# Ritaglia solo se la banda totale supera il 3% dell'altezza (evita micro-ritagli).
MIN_BAND_FRACTION = 0.03


def row_is_black(im: Image.Image, w: int, y: int) -> bool:
    step = max(1, w // 40)
    vals = [sum(im.getpixel((x, y))) / 3 for x in range(0, w, step)]
    mean = sum(vals) / len(vals)
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    return mean < ROW_MEAN_MAX and var ** 0.5 < ROW_STD_MAX


def band_counts(im: Image.Image):
    w, h = im.size
    top = 0
    for y in range(0, int(h * 0.5)):
        if row_is_black(im, w, y):
            top += 1
        else:
            break
    bot = 0
    for y in range(h - 1, int(h * 0.5), -1):
        if row_is_black(im, w, y):
            bot += 1
        else:
            break
    return top, bot


def crop_box(im: Image.Image):
    """Return (box, top, bot) if a meaningful letterbox should be cropped, else None."""
    w, h = im.size
    top, bot = band_counts(im)
    if top + bot < h * MIN_BAND_FRACTION:
        return None
    new_h = h - top - bot
    # Deve restare un ritratto decente (il validatore master chiede min lato >= 768).
    if new_h < 768 or new_h <= w:
        # Se il taglio renderebbe l'immagine non-ritratto o troppo piccola,
        # taglia quel che basta a rimanere valida mantenendo il ritratto.
        max_crop = h - max(769, w + 1)
        if max_crop <= h * MIN_BAND_FRACTION:
            return None
        # distribuisci il taglio proporzionalmente tra alto e basso
        total = top + bot
        top = int(max_crop * (top / total)) if total else 0
        bot = max_crop - top
        new_h = h - top - bot
        if new_h < 768 or new_h <= w:
            return None
    return (0, top, w, h - bot), top, bot


def local_master(sid: str) -> Path | None:
    for ext in ("webp", "jpg", "jpeg", "png"):
        p = COVERS / f"{sid}.{ext}"
        if p.exists():
            return p
    return None


def analyse(sid: str):
    p = local_master(sid)
    if not p:
        return None
    with Image.open(p) as im:
        im = im.convert("RGB")
        res = crop_box(im)
        return (p, im.size, res)


async def scan(db, limit):
    docs = await db.stories.find({"hero_image_generated": {"$nin": [None, ""]}},
                                 {"_id": 0, "id": 1, "title": 1}).to_list(None)
    hits = []
    for d in docs:
        a = analyse(d["id"])
        if a and a[2]:
            (_, (w, h), (_, top, bot)) = a
            hits.append((d["id"], h, top, bot, round((top + bot) / h, 2)))
    hits.sort(key=lambda x: -x[4])
    print(f"{len(docs)} covers, {len(hits)} with a solid letterbox band", flush=True)
    for sid, h, top, bot, frac in hits[:limit] if limit else hits:
        print(f"  {sid}: top={top} bot={bot} band={frac}", flush=True)
    return [h[0] for h in hits]


async def _store(db, sid, raw, cropped_note):
    """Upload + DB update with one retry on transient storage errors."""
    for attempt in range(3):
        try:
            fields = await asyncio.to_thread(upload_cover, sid, raw)
            fields["cover_letterbox_fixed"] = True
            await db.stories.update_one({"id": sid}, {"$set": fields})
            print(f"  OK {sid}: {cropped_note}", flush=True)
            return True
        except Exception as exc:  # noqa: BLE001
            print(f"  retry {sid} ({attempt}): {str(exc)[:90]}", flush=True)
            await asyncio.sleep(1.5 * (attempt + 1))
    print(f"  FAIL {sid}: giving up", flush=True)
    return False


async def fix(db, limit, only):
    BACKUP.mkdir(exist_ok=True)
    candidates = await scan(db, 0)
    if only is not None:
        candidates = [c for c in candidates if c in only]
    if limit:
        candidates = candidates[:limit]
    print(f"fixing {len(candidates)} covers", flush=True)
    ok = 0
    for sid in candidates:
        p = local_master(sid)
        if not p:
            print(f"  SKIP {sid}: no local master")
            continue
        with Image.open(p) as im:
            im = im.convert("RGB")
            res = crop_box(im)
            if not res:
                continue
            box, top, bot = res
            cropped = im.crop(box)
        dest = BACKUP / p.name
        if not dest.exists():
            dest.write_bytes(p.read_bytes())
        buf = io.BytesIO()
        cropped.save(buf, "WEBP", quality=90, method=6)
        raw = buf.getvalue()
        p.write_bytes(raw)  # master locale aggiornato (persiste al riavvio)
        if await _store(db, sid, raw, f"cropped top={top} bot={bot} -> {cropped.size}"):
            ok += 1
    print(f"[done] fixed {ok}/{len(candidates)}")


async def resync(db, only):
    """Riallinea DB/storage al master locale per copertine il cui digest è
    disallineato (es. crop applicato ma upload fallito a metà)."""
    from media_opt import source_digest
    docs = await db.stories.find({"hero_image_generated": {"$nin": [None, ""]}},
                                 {"_id": 0, "id": 1, "hero_source_digest": 1}).to_list(None)
    fixed = 0
    for d in docs:
        sid = d["id"]
        if only is not None and sid not in only:
            continue
        p = local_master(sid)
        if not p:
            continue
        raw = p.read_bytes()
        if source_digest(raw) == d.get("hero_source_digest"):
            continue
        if await _store(db, sid, raw, "resynced from local master"):
            fixed += 1
    print(f"[resync done] {fixed} covers realigned")


async def restore(db, sid):
    files = list(BACKUP.glob(f"{sid}.*"))
    if not files:
        print(f"no backup for {sid}")
        return
    raw = files[0].read_bytes()
    for cur in COVERS.glob(f"{sid}.*"):
        cur.unlink()
    (COVERS / files[0].name).write_bytes(raw)
    fields = await asyncio.to_thread(upload_cover, sid, raw)
    fields["cover_letterbox_fixed"] = False
    await db.stories.update_one({"id": sid}, {"$set": fields})
    print(f"restored {sid}")


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["scan", "fix", "restore", "resync"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only")
    args = ap.parse_args()
    only = set(args.only.split(",")) if args.only else None
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    if args.cmd == "scan":
        await scan(db, args.limit)
    elif args.cmd == "fix":
        await fix(db, args.limit, only)
    elif args.cmd == "restore":
        await restore(db, args.arg)
    elif args.cmd == "resync":
        await resync(db, only)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
