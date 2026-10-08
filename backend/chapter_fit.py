"""PAUSE — capitoli snelliti per stare in una schermata (vedi fit_chapters.py).

`chapter_fit_overrides.json`: {story_id: {lang: {chapter_index: body}}}.
`apply_fit_overrides(db)` riscrive quei corpi a ogni avvio, così un DB nuovo
(fork/deploy) riparte già con la versione corta. Idempotente.
"""
import json
from pathlib import Path

OVERRIDES_PATH = Path(__file__).parent / "chapter_fit_overrides.json"


def load_overrides() -> dict:
    if not OVERRIDES_PATH.exists():
        return {}
    return json.loads(OVERRIDES_PATH.read_text())


async def apply_fit_overrides(db) -> dict:
    overrides = load_overrides()
    stats = {"stories": 0, "chapters": 0, "skipped": 0}
    for sid, langs in overrides.items():
        doc = await db.stories.find_one({"id": sid}, {"_id": 0, "chapters": 1, "translations": 1})
        if not doc:
            stats["skipped"] += 1
            continue
        fields = {}
        for lang, bodies in langs.items():
            chapters = doc.get("chapters") if lang == "it" else ((doc.get("translations") or {}).get(lang) or {}).get("chapters")
            prefix = "chapters" if lang == "it" else f"translations.{lang}.chapters"
            for idx, body in bodies.items():
                i = int(idx)
                if chapters and i < len(chapters) and chapters[i].get("body") != body:
                    fields[f"{prefix}.{i}.body"] = body
        if fields:
            fields["content_fit"] = True
            fields["chapters_v6"] = True
            await db.stories.update_one({"id": sid}, {"$set": fields})
            stats["stories"] += 1
            stats["chapters"] += len(fields) - 2
    return stats
