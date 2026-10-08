"""PAUSE — "una schermata per capitolo": snellisce i capitoli troppo lunghi.

Ogni capitolo (IT e, se esiste, EN) il cui corpo supera MAX_CHARS viene
condensato da GPT-5.4 (stesso modello editoriale del catalogo): stessi fatti,
stesso titolo, stesso tono, nessuna invenzione — si tolgono ripetizioni, incisi
ed esempi ridondanti. Titoli, hook, riepilogo, icone e copertine non si toccano.

Persistenza: il testo accorciato va nel DB e in `chapter_fit_overrides.json`,
che `ensure_seed` riapplica a ogni avvio (anche su un DB nuovo). L'originale è
copiato una volta in `stories_backup_pre_fit`.

Usage (da backend/):
    python fit_chapters.py --dry-run          # solo report
    python fit_chapters.py --limit 3          # prova su pochi
    python fit_chapters.py                    # tutti i capitoli oltre soglia
    python fit_chapters.py --only <id>,<id>
    python fit_chapters.py --restore <id>     # rimette il backup
"""
import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from chapter_fit import OVERRIDES_PATH, load_overrides  # noqa: E402

MODEL = ("openai", "gpt-5.4")
# Un capitolo sta in una schermata (titolo su 2 righe + anticipazione del
# successivo) su un telefono standard fino a ~550 caratteri; 500 lascia margine.
MAX_CHARS = 500
TARGET_CHARS = 450
MIN_CHARS = 180
CONCURRENCY = 4
BACKUP = "stories_backup_pre_fit"
LANG_NAME = {"it": "Italian", "en": "English"}

SYSTEM = (
    "You are the senior editor of PAUSE, a premium micro-learning app. You tighten existing chapters so "
    "each one fits a single phone screen, without changing what it says. You never add facts, never drop "
    "a key idea, number, name or the logical thread, never change the language, tone or point of view, "
    "and you keep the prose vivid and precise. You answer with valid JSON only, no markdown fences."
)

PROMPT = """Below is a {lang_name} {kind} from PAUSE, with all its chapters for context.
Rewrite ONLY the chapters listed in "rewrite" so that each body is at most {budget} characters
including spaces — roughly {words} words (hard limit {hard}: models tend to overshoot, so aim clearly below). Keep it {lang_name}.

Rules:
- Cut repetition, filler, long asides and redundant examples. Keep every fact, number, name and the
  logical thread. Do not invent anything. Do not summarise the whole story: each chapter keeps its own content.
- Each body stays one fluent paragraph of at least 2 sentences, no line breaks, no bullet points.
- Preserve the original register (second person, warm, curious) and the chapter's opening idea.
- Do not touch titles.

Return JSON with this exact shape: {{"chapters": [{{"index": <int>, "body": "..."}}]}} — one entry per index in "rewrite".

Story title: {title}
Chapters:
{payload}

rewrite: {rewrite}"""


def parse_json(raw: str) -> dict:
    raw = re.sub(r"^```(?:json)?", "", raw.strip()).strip()
    raw = re.sub(r"```$", "", raw).strip()
    return json.loads(raw[raw.find("{"): raw.rfind("}") + 1])


def chapters_of(doc: dict, lang: str) -> list[dict]:
    if lang == "it":
        return doc.get("chapters") or []
    return ((doc.get("translations") or {}).get(lang) or {}).get("chapters") or []


def title_of(doc: dict, lang: str) -> str:
    if lang == "it":
        return doc.get("title", "")
    return ((doc.get("translations") or {}).get(lang) or {}).get("title") or doc.get("title", "")


def validate(body: str, hard: int) -> str | None:
    b = body.strip()
    if "\n" in b:
        return "line break"
    if len(b) > hard:
        return f"too long ({len(b)})"
    if len(b) < MIN_CHARS:
        return f"too short ({len(b)})"
    if len(re.findall(r"[.!?…][\s»\"”]*(?:\s|$)", b)) < 2:
        return "fewer than 2 sentences"
    return None


async def condense(sid: str, lang: str, doc: dict, indices: list[int]) -> dict[int, str]:
    chapters = chapters_of(doc, lang)
    payload = "\n".join(f'[{i}] "{c.get("title", "")}": {c.get("body", "")}' for i, c in enumerate(chapters))
    budget = TARGET_CHARS
    pending = set(indices)
    done: dict[int, str] = {}
    last = "no attempt"
    for attempt in range(5):
        prompt = PROMPT.format(
            lang_name=LANG_NAME[lang], kind="mini-lesson" if doc.get("kind") == "lesson" else "curiosity",
            budget=budget, words=budget // 7, hard=MAX_CHARS, title=title_of(doc, lang), payload=payload, rewrite=sorted(pending),
        )
        chat = LlmChat(api_key=os.environ["EMERGENT_LLM_KEY"], session_id=f"fit-{sid}-{lang}-{attempt}", system_message=SYSTEM)
        chat.with_model(*MODEL)
        try:
            result = parse_json(await chat.send_message(UserMessage(text=prompt)))
        except Exception as exc:  # network / JSON
            last = f"llm error: {exc}"
            continue
        errors = []
        for item in result.get("chapters", []):
            i = item.get("index")
            if i not in pending or not isinstance(item.get("body"), str):
                continue
            err = validate(item["body"], MAX_CHARS)
            if err:
                errors.append(f"[{i}] {err}")
                continue
            done[i] = item["body"].strip()
            pending.discard(i)
        if not pending:
            return done
        last = "; ".join(errors) or f"missing {sorted(pending)}"
        budget -= 50
    raise RuntimeError(f"{sid}/{lang}: {last}")


def save_override(overrides: dict, sid: str, lang: str, bodies: dict[int, str]) -> None:
    overrides.setdefault(sid, {}).setdefault(lang, {}).update({str(i): b for i, b in bodies.items()})
    tmp = OVERRIDES_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True))
    tmp.replace(OVERRIDES_PATH)


async def process(db, doc: dict, lang: str, indices: list[int], dry_run: bool, sem: asyncio.Semaphore, overrides: dict, lock: asyncio.Lock) -> str:
    sid = doc["id"]
    before = [len(chapters_of(doc, lang)[i]["body"]) for i in indices]
    if dry_run:
        return f"{sid} [{lang}] would fit chapters {indices} ({before} chars)"
    async with sem:
        try:
            bodies = await condense(sid, lang, doc, indices)
        except Exception as exc:
            return f"{sid} [{lang}] FAILED {exc}"
    if not await db[BACKUP].find_one({"id": sid}, {"_id": 1}):
        original = await db.stories.find_one({"id": sid}, {"_id": 0})
        await db[BACKUP].insert_one({**original, "backed_up_at": datetime.now(timezone.utc)})
    prefix = "chapters" if lang == "it" else f"translations.{lang}.chapters"
    fields = {f"{prefix}.{i}.body": b for i, b in bodies.items()}
    fields["content_fit"] = True
    fields["chapters_v6"] = True
    fields[f"content_fit_log.{lang}"] = {"at": datetime.now(timezone.utc), "model": "/".join(MODEL), "chapters": indices}
    await db.stories.update_one({"id": sid}, {"$set": fields})
    async with lock:
        save_override(overrides, sid, lang, bodies)
    after = [len(bodies[i]) for i in indices]
    return f"{sid} [{lang}] fitted {indices}: {before} → {after}"


async def restore(db, story_id: str, overrides: dict) -> None:
    backup = await db[BACKUP].find_one({"id": story_id}, {"_id": 0, "backed_up_at": 0})
    if not backup:
        print(f"no backup for {story_id}")
        return
    await db.stories.replace_one({"id": story_id}, backup)
    if overrides.pop(story_id, None) is not None:
        OVERRIDES_PATH.write_text(json.dumps(overrides, ensure_ascii=False, indent=1, sort_keys=True))
    print(f"restored {story_id} from backup")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only", help="comma-separated story ids")
    parser.add_argument("--restore", help="story id to restore from backup")
    args = parser.parse_args()

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    overrides = load_overrides()
    if args.restore:
        await restore(db, args.restore, overrides)
        client.close()
        return

    query = {"id": {"$in": args.only.split(",")}} if args.only else {}
    docs = await db.stories.find(query, {"_id": 0}).to_list(5000)
    jobs = []
    for d in docs:
        for lang in ("it", "en"):
            over = [i for i, c in enumerate(chapters_of(d, lang)) if len(c.get("body", "")) > MAX_CHARS]
            if over:
                jobs.append((d, lang, over))
    if args.limit:
        jobs = jobs[: args.limit]
    print(f"{len(docs)} stories, {len(jobs)} narrations with chapters over {MAX_CHARS} chars "
          f"({sum(len(j[2]) for j in jobs)} chapters)", flush=True)

    sem, lock = asyncio.Semaphore(CONCURRENCY), asyncio.Lock()
    results = await asyncio.gather(*[process(db, d, lang, over, args.dry_run, sem, overrides, lock) for d, lang, over in jobs])
    failed = 0
    for status in results:
        print(status, flush=True)
        failed += "FAILED" in status
    print(f"done: {len(results) - failed} ok, {failed} failed", flush=True)
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
