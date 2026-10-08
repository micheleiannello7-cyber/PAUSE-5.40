"""PAUSE — meno volti/persone AI sulle copertine, solo dove c'è un'alternativa coerente.

Fasi (da backend/):
    python reduce_faces.py scan              # vision: quali copertine mostrano persone/volti → cover_faces_audit.json
    python reduce_faces.py plan              # editor: per ognuna decide keep/replace + nuovo prompt → cover_faces_plan.json
    python reduce_faces.py apply [--limit N] [--only id,id]
                                             # genera, verifica (niente volti + coerente), sostituisce; originale in covers_backup_pre_nofaces/
    python reduce_faces.py restore <id>      # rimette l'originale

Stessa pipeline qualitativa delle copertine attuali: generate_images.MODEL + generate_covers.STYLE,
master WebP in covers/<id>.webp (sincronizzato nello storage a ogni avvio), prompt salvato in
cover_prompt_overrides.json così una rigenerazione futura resta senza volti.
"""
import argparse
import asyncio
import base64
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from emergentintegrations.llm.chat import ImageContent, LlmChat, UserMessage  # noqa: E402
from cover_review import REVIEW_MODEL, read_image, vision_jpeg  # noqa: E402
from covers_sync import local_covers  # noqa: E402
from generate_covers import STYLE, save_original  # noqa: E402
from generate_images import generate_image  # noqa: E402
from media_opt import upload_cover  # noqa: E402

AUDIT = ROOT / "cover_faces_audit.json"
PLAN = ROOT / "cover_faces_plan.json"
DECISIONS = ROOT / "cover_faces_decisions.json"
OVERRIDES = ROOT / "cover_prompt_overrides.json"
BACKUP_DIR = ROOT / "covers_backup_pre_nofaces"
EDITOR_MODEL = ("openai", "gpt-5.4")
NO_PEOPLE = (" Absolutely no people, no human figures, no human faces, no hands, no silhouettes of people, "
             "no mannequins or statues of people.")
NO_FACES = (" No human faces, no readable facial features, no eyes or mouth, no full human figure: at most hands "
            "or a tightly cropped faceless detail.")


def load(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def dump(path, data):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True))
    tmp.replace(path)


def parse_json(raw: str) -> dict:
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(raw[raw.find("{"): raw.rfind("}") + 1])


def cover_bytes(doc: dict) -> bytes:
    local = local_covers().get(doc["id"])
    return local.read_bytes() if local else read_image(doc["hero_image_generated"])


async def vision(prompt: str, raw: bytes) -> dict:
    chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"faces-{uuid.uuid4().hex}",
                   system_message="You are a careful visual editor. Answer with JSON only.")
    chat.with_model("gemini", REVIEW_MODEL)
    text = await asyncio.wait_for(chat.send_message(UserMessage(
        text=prompt, file_contents=[ImageContent(image_base64=base64.b64encode(vision_jpeg(raw)).decode())])), timeout=120)
    return parse_json(text)


# ----------------------------------------------------------------------------- scan
SCAN_PROMPT = (
    "Look at this magazine-style cover image. Report what is visible, nothing inferred.\n"
    "people: 'none' (no human beings at all), 'minor' (tiny/background/hands-only/silhouette far away), "
    "'prominent' (a person or body is a main subject).\n"
    "faces: 'none', 'partial' (turned away, blurred, cropped, masked, in shadow), 'clear' (a readable human face).\n"
    "Return ONLY JSON: {\"people\":\"none|minor|prominent\",\"faces\":\"none|partial|clear\","
    "\"description\":\"one short Italian sentence of what is depicted\"}"
)


async def scan(db, limit: int) -> None:
    audit = load(AUDIT, {})
    docs = await db.stories.find({"hero_image_generated": {"$nin": [None, ""]}},
                                 {"_id": 0, "id": 1, "title": 1, "hero_image_generated": 1, "hero_source_digest": 1}).to_list(None)
    todo = [d for d in docs if audit.get(d["id"], {}).get("digest") != d.get("hero_source_digest")]
    if limit:
        todo = todo[:limit]
    print(f"{len(docs)} covers, {len(todo)} to scan", flush=True)
    sem, lock = asyncio.Semaphore(6), asyncio.Lock()

    async def one(d):
        async with sem:
            try:
                raw = await asyncio.to_thread(cover_bytes, d)
                res = await vision(SCAN_PROMPT, raw)
                entry = {"people": res.get("people"), "faces": res.get("faces"), "description": res.get("description", ""),
                         "digest": d.get("hero_source_digest"), "title": d.get("title")}
            except Exception as exc:  # noqa: BLE001
                print(f"  FAIL {d['id']}: {str(exc)[:120]}", flush=True)
                return
        async with lock:
            audit[d["id"]] = entry
            dump(AUDIT, audit)
        print(f"  {d['id']}: people={entry['people']} faces={entry['faces']}", flush=True)

    await asyncio.gather(*(one(d) for d in todo))
    summary(audit)


def flagged(audit: dict) -> list[str]:
    return sorted(sid for sid, a in audit.items() if a.get("faces") in ("partial", "clear") or a.get("people") == "prominent")


def summary(audit: dict) -> None:
    from collections import Counter
    print("people:", dict(Counter(a.get("people") for a in audit.values())))
    print("faces: ", dict(Counter(a.get("faces") for a in audit.values())))
    print("flagged (faces or prominent people):", len(flagged(audit)))


# ----------------------------------------------------------------------------- plan
PLAN_SYSTEM = (
    "You are the art director of PAUSE, a premium dark editorial micro-learning app. The publisher wants fewer "
    "AI-generated human faces and people on covers, but ONLY where a coherent, equally strong cover without people "
    "is possible. You never propose a generic or off-topic image: the replacement must depict the concrete subject "
    "of the story (object, animal, place, phenomenon, document, tool, food, instrument, artwork, landscape, "
    "scientific detail) or a precise editorial metaphor that a reader instantly links to the title. "
    "Keep the person when the story is intrinsically about a human face/expression/portrait, a specific person's "
    "likeness, or when the only people-free idea is a stretched metaphor (e.g. swords for a handshake): a reader must "
    "not need the title to understand the image. A faceless detail is allowed and often ideal when the story is about "
    "a gesture or the body: hands only, a close crop with no face, an anatomical model. Expect roughly one in four "
    "covers to be kept. Answer with JSON only."
)
PLAN_PROMPT = """Story (Italian, category: {category}):
Title: {title}
Hook: {hook}
Summary: {summary}

Current cover (as seen by a reviewer): {description}
People: {people}; faces: {faces}.

Decide: "replace" if a people-free cover can be at least as coherent and specific, otherwise "keep".
If "replace", write an English image prompt (2–4 sentences) for a photorealistic vertical 3:4 editorial cover
describing exactly ONE clear, recognisable, story-specific subject, its materials, setting and light.
No faces, no readable human features, no human silhouettes as subject, no text. Hands or a faceless close crop are
allowed only if the story is about a gesture or the body; otherwise no people at all.
Return ONLY JSON: {{"decision":"replace|keep","reason":"short Italian reason","prompt":"... or empty","allow_hands":true|false}}"""


async def plan(db, limit: int, only: set[str] | None) -> None:
    audit = load(AUDIT, {})
    plan_data = load(PLAN, {})
    ids = [sid for sid in flagged(audit) if (only is None or sid in only)]
    todo = [sid for sid in ids if sid not in plan_data or only is not None]
    if limit:
        todo = todo[:limit]
    print(f"{len(ids)} flagged, {len(todo)} to plan", flush=True)
    docs = {d["id"]: d for d in await db.stories.find({"id": {"$in": todo}}, {"_id": 0, "id": 1, "title": 1, "hook": 1,
                                                        "summary": 1, "category_name": 1}).to_list(None)}
    sem, lock = asyncio.Semaphore(4), asyncio.Lock()

    async def one(sid):
        d, a = docs[sid], audit[sid]
        prompt = PLAN_PROMPT.format(category=d.get("category_name", ""), title=d.get("title", ""), hook=d.get("hook", ""),
                                    summary=(d.get("summary") or "")[:600], description=a.get("description", ""),
                                    people=a.get("people"), faces=a.get("faces"))
        async with sem:
            try:
                chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"faces-plan-{sid}", system_message=PLAN_SYSTEM)
                chat.with_model(*EDITOR_MODEL)
                res = parse_json(await chat.send_message(UserMessage(text=prompt)))
            except Exception as exc:  # noqa: BLE001
                print(f"  FAIL {sid}: {str(exc)[:120]}", flush=True)
                return
        decision = res.get("decision") if res.get("decision") in ("replace", "keep") else "keep"
        if decision == "replace" and len((res.get("prompt") or "").strip()) < 40:
            decision = "keep"
        async with lock:
            plan_data[sid] = {"decision": decision, "reason": res.get("reason", ""), "prompt": (res.get("prompt") or "").strip(),
                              "allow_hands": bool(res.get("allow_hands")), "title": d.get("title"), "status": "pending"}
            dump(PLAN, plan_data)
        print(f"  {sid}: {decision} — {res.get('reason', '')[:90]}", flush=True)

    await asyncio.gather(*(one(s) for s in todo))
    n_rep = sum(1 for p in plan_data.values() if p["decision"] == "replace")
    print(f"plan: {n_rep} replace, {len(plan_data) - n_rep} keep")


# ----------------------------------------------------------------------------- apply
VERIFY_PROMPT = (
    "You review a candidate cover for this Italian article: {article}.\n"
    "1) people: 'none' | 'minor' | 'prominent'; faces: 'none' | 'partial' | 'clear' — report only what is visible.\n"
    "2) verdict: 'coherent' if the visible subject clearly matches the article's concrete subject or is a precise editorial "
    "metaphor for it; 'mismatch' if unrelated or generic; 'uncertain' otherwise.\n"
    "3) quality: 'ok' or 'bad' (bad = deformed anatomy, garbled text, obvious artefacts, cluttered, not a clean editorial cover).\n"
    "Return ONLY JSON: {{\"people\":\"...\",\"faces\":\"...\",\"verdict\":\"...\",\"quality\":\"...\",\"reason\":\"short Italian\"}}"
)


def backup_original(doc: dict) -> Path:
    BACKUP_DIR.mkdir(exist_ok=True)
    local = local_covers().get(doc["id"])
    if local:
        dest = BACKUP_DIR / local.name
        if not dest.exists():
            dest.write_bytes(local.read_bytes())
        return dest
    dest = BACKUP_DIR / f"{doc['id']}.webp"
    if not dest.exists():
        from storage import get_object
        raw, _ = get_object(doc["hero_image_generated"])
        dest.write_bytes(raw)
    return dest


async def apply(db, limit: int, only: set[str] | None) -> None:
    plan_data = load(PLAN, {})
    decisions = load(DECISIONS, {})
    todo = [sid for sid, p in plan_data.items() if p["decision"] == "replace" and p.get("status") == "pending"
            and (only is None or sid in only)]
    if limit:
        todo = todo[:limit]
    print(f"{len(todo)} covers to regenerate", flush=True)
    docs = {d["id"]: d for d in await db.stories.find({"id": {"$in": todo}}, {"_id": 0}).to_list(None)}
    sem, lock = asyncio.Semaphore(3), asyncio.Lock()
    stats = {"ok": 0, "rejected": 0, "fail": 0}
    stop = asyncio.Event()

    async def set_status(sid, **fields):
        async with lock:
            plan_data[sid].update(fields)
            dump(PLAN, plan_data)

    async def one(sid):
        if stop.is_set():
            return
        d, p = docs[sid], plan_data[sid]
        article = json.dumps({k: d.get(k, "") for k in ("title", "hook", "category_name")}, ensure_ascii=False)
        base_prompt = p["prompt"]
        negative = NO_FACES if p.get("allow_hands") else NO_PEOPLE
        async with sem:
            try:
                backup = await asyncio.to_thread(backup_original, d)
                for attempt in range(2):
                    prompt = base_prompt + negative + STYLE
                    if attempt:
                        prompt = base_prompt + " Make the subject unmistakably specific to the story." + negative + STYLE
                    raw, _ = await asyncio.wait_for(generate_image(f"pause-nofaces-{sid}-{attempt}-{uuid.uuid4().hex[:6]}", prompt), timeout=240)
                    check = await vision(VERIFY_PROMPT.format(article=article), raw)
                    people_ok = check.get("people") == "none" or (p.get("allow_hands") and check.get("people") == "minor")
                    good = (people_ok and check.get("faces") == "none"
                            and check.get("verdict") == "coherent" and check.get("quality") == "ok")
                    print(f"  {sid} try{attempt}: people={check.get('people')} faces={check.get('faces')} "
                          f"verdict={check.get('verdict')} quality={check.get('quality')} — {check.get('reason', '')[:80]}", flush=True)
                    if good:
                        break
                else:
                    stats["rejected"] += 1
                    await set_status(sid, status="rejected", check=check)
                    return
                # Nuovo master locale + storage + DB (stessi campi di generate_covers)
                source = save_original(sid, raw)
                for old in local_covers().get(sid, source).parent.glob(f"{sid}.*"):
                    if old != source and old.suffix.lower() in (".png", ".jpg", ".jpeg"):
                        old.unlink()
                fields = await asyncio.to_thread(upload_cover, sid, source.read_bytes())
                fields["hero_generated_at"] = datetime.now(timezone.utc).isoformat()
                fields["cover_faces_replaced"] = True
                await db.stories.update_one({"id": sid}, {"$set": fields})
                async with lock:
                    overrides = load(OVERRIDES, {})
                    overrides[sid] = base_prompt + negative
                    dump(OVERRIDES, overrides)
                    decisions[sid] = {"at": fields["hero_generated_at"], "backup": str(backup.relative_to(ROOT)),
                                      "previous": d.get("hero_image_generated"), "reason": p["reason"], "check": check}
                    dump(DECISIONS, decisions)
                await set_status(sid, status="done", check=check)
                stats["ok"] += 1
                print(f"  OK {sid}", flush=True)
            except Exception as exc:  # noqa: BLE001
                stats["fail"] += 1
                msg = str(exc).lower()
                print(f"  FAIL {sid}: {str(exc)[:160]}", flush=True)
                if any(k in msg for k in ("budget", "insufficient", "402", "quota", "credit", "429")):
                    stop.set()

    await asyncio.gather(*(one(s) for s in todo))
    print(f"[done] {stats} stopped={stop.is_set()}")


async def restore(db, sid: str) -> None:
    files = list(BACKUP_DIR.glob(f"{sid}.*"))
    if not files:
        print(f"no backup for {sid}")
        return
    raw = files[0].read_bytes()
    for cur in (ROOT / "covers").glob(f"{sid}.*"):
        cur.unlink()
    (ROOT / "covers" / files[0].name).write_bytes(raw)
    fields = upload_cover(sid, raw)
    fields["cover_faces_replaced"] = False
    await db.stories.update_one({"id": sid}, {"$set": fields})
    overrides = load(OVERRIDES, {})
    if overrides.pop(sid, None) is not None:
        dump(OVERRIDES, overrides)
    plan_data = load(PLAN, {})
    if sid in plan_data:
        plan_data[sid].update(status="restored")
        dump(PLAN, plan_data)
    decisions = load(DECISIONS, {})
    if decisions.pop(sid, None) is not None:
        dump(DECISIONS, decisions)
    print(f"restored {sid}")


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["scan", "plan", "apply", "restore", "summary"])
    ap.add_argument("arg", nargs="?")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only")
    args = ap.parse_args()
    only = set(args.only.split(",")) if args.only else None
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    if args.cmd == "scan":
        await scan(db, args.limit)
    elif args.cmd == "summary":
        summary(load(AUDIT, {}))
    elif args.cmd == "plan":
        await plan(db, args.limit, only)
    elif args.cmd == "apply":
        await apply(db, args.limit, only)
    elif args.cmd == "restore":
        await restore(db, args.arg)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
