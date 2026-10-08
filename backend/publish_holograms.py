"""PAUSE — pubblica la famiglia di icone 3D "holo-v1" generata da
gen_category_holograms.py. NON cancella nulla: le vecchie famiglie restano
archiviate in Object Storage e il vecchio manifest viene salvato a parte.

Esegui SOLO quando tutte e 13 le categorie sono in
category_art/holo-v1/import-report.json:

    cd backend && python publish_holograms.py

Fa tre cose, tutte idempotenti:
  1. salva il manifest corrente come category_art_manifest.<vecchia-versione>.json (archivio);
  2. riscrive category_art_manifest.json → holo-v1 (così un DB nuovo recupera le associazioni);
  3. aggiorna il DB (illustration_generated) in modo che l'app serva subito le nuove icone.
"""
import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

REPORT_PATH = ROOT / "category_art" / "holo-v1" / "import-report.json"
MANIFEST_PATH = ROOT / "category_art_manifest.json"


async def main() -> None:
    report = json.loads(REPORT_PATH.read_text())
    artworks = report["artworks"]
    missing = [c for c in [
        "scienza", "spazio", "tecnologia", "natura", "animali", "storia",
        "psicologia", "corpo-umano", "cultura", "economia", "arte", "geografia", "all",
    ] if c not in artworks]
    if missing:
        raise SystemExit(f"Non pubblico: mancano ancora {missing}. Genera prima tutte le icone.")

    # 1 + 2 — archivia il vecchio manifest e riscrivi quello attivo.
    old = json.loads(MANIFEST_PATH.read_text())
    archive = ROOT / f"category_art_manifest.{old['version']}.json"
    if not archive.exists():
        archive.write_text(json.dumps(old, indent=2) + "\n")
        print(f"archiviato vecchio manifest → {archive.name}")
    MANIFEST_PATH.write_text(json.dumps({"version": report["version"], "artworks": artworks}, indent=2) + "\n")
    print(f"manifest aggiornato → {report['version']}")

    # 3 — aggiorna il DB subito (niente attesa del restart).
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    for cid, path in artworks.items():
        collection = db.design_assets if cid == "all" else db.categories
        asset_id = "category-all" if cid == "all" else cid
        await collection.update_one(
            {"id": asset_id},
            {"$set": {"illustration_generated": path, "illustration_revision": report["version"]}},
            upsert=cid == "all",
        )
        print(f"DB {cid} → {path}")
    client.close()
    print("\nFatto. Ricorda di aver impostato ART_VERSION = 'holo-v1' nel frontend.")


if __name__ == "__main__":
    asyncio.run(main())
