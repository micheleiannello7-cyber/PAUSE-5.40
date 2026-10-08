"""Punto focale delle copertine — lo "zoom intelligente" del lettore.

Quando si passa al primo capitolo la copertina resta come sfondo e il lettore
la ingrandisce sulla parte bella o utile dell'immagine (il buco nero, il
soggetto, non un angolo di cielo). Dove sta quel soggetto lo stimiamo qui, una
volta per copertina, con una semplice mappa di salienza:

  * rarità del colore rispetto al colore mediano dell'immagine (lo sfondo),
  * contrasto locale (bordi), saturazione,
  * una leggera preferenza per il centro, così i bordi contano meno.

La mappa viene sfocata molto: contano le zone, non i dettagli (stelle, grana).
Si prende la regione connessa al picco e se ne calcolano il baricentro e
l'estensione. Risultato, normalizzato sull'immagine (0..1), salvato nella
storia come `hero_focal`:

  {"x", "y": centro del soggetto, "r": raggio equivalente in frazione
   dell'altezza, "aspect": larghezza/altezza, "src": path della copertina}

`src` serve a riconoscere una copertina cambiata (il focale viene ricalcolato).
Uso da riga di comando: `python cover_focus.py [--force] [story-id ...]`.
"""
from __future__ import annotations

import asyncio
import math
import sys
from io import BytesIO

import numpy as np
from PIL import Image
from starlette.concurrency import run_in_threadpool

# Lato lungo della miniatura su cui si calcola la salienza.
SMALL = 96
# Soglie (frazione del picco) della regione del soggetto: nucleo per il
# baricentro, zona più ampia per l'estensione.
CORE = 0.6
EXTENT = 0.45


def _blur(a: np.ndarray, sigma: float) -> np.ndarray:
    """Sfocatura gaussiana separabile (bordi riflessi) su una piccola matrice."""
    if sigma <= 0:
        return a
    radius = max(1, int(sigma * 3))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-(x ** 2) / (2 * sigma ** 2))
    kernel /= kernel.sum()
    padded = np.pad(a, radius, mode="reflect")
    rows = np.apply_along_axis(lambda r: np.convolve(r, kernel, mode="valid"), 1, padded)
    return np.apply_along_axis(lambda c: np.convolve(c, kernel, mode="valid"), 0, rows).astype(np.float32)


def _norm(a: np.ndarray) -> np.ndarray:
    hi = float(np.percentile(a, 98))
    return np.clip(a / hi, 0, 1) if hi > 1e-6 else np.zeros_like(a)


def saliency(im: Image.Image) -> np.ndarray:
    w, h = im.size
    k = SMALL / max(w, h)
    sw, sh = max(8, round(w * k)), max(8, round(h * k))
    small = np.asarray(im.convert("RGB").resize((sw, sh), Image.LANCZOS), dtype=np.float32) / 255.0
    # 1. Rarità del colore: quanto ogni pixel si discosta dal colore mediano (lo sfondo).
    med = np.median(small.reshape(-1, 3), axis=0)
    rare = np.sqrt(((small - med) ** 2).sum(-1))
    # 2. Contrasto locale: gradiente della luminanza.
    lum = small @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    gy, gx = np.gradient(_blur(lum, 1.0))
    edges = np.hypot(gx, gy)
    # 3. Saturazione.
    sat = small.max(-1) - small.min(-1)
    sal = 0.5 * _norm(rare) + 0.3 * _norm(edges) + 0.2 * _norm(sat)
    # Leggera preferenza per il centro.
    yy, xx = np.mgrid[0:sh, 0:sw]
    cx, cy = (sw - 1) / 2, (sh - 1) / 2
    prior = np.exp(-(((xx - cx) / (sw * 0.55)) ** 2 + ((yy - cy) / (sh * 0.55)) ** 2))
    sal = sal * (0.35 + 0.65 * prior)
    # Contano le zone, non i dettagli.
    return _blur(sal, max(sw, sh) * 0.06)


def _component(mask: np.ndarray, seed: tuple[int, int]) -> np.ndarray:
    """Regione connessa (4-vicini) di `mask` che contiene `seed`."""
    comp = np.zeros_like(mask)
    comp[seed] = True
    while True:
        grown = comp.copy()
        grown[1:, :] |= comp[:-1, :]
        grown[:-1, :] |= comp[1:, :]
        grown[:, 1:] |= comp[:, :-1]
        grown[:, :-1] |= comp[:, 1:]
        grown &= mask
        if np.array_equal(grown, comp):
            return comp
        comp = grown


def compute_focal(data: bytes) -> dict:
    im = Image.open(BytesIO(data))
    im.load()
    w, h = im.size
    sal = saliency(im)
    sh, sw = sal.shape
    peak = float(sal.max())
    if peak <= 1e-6:
        return {"x": 0.5, "y": 0.5, "r": 0.35, "aspect": round(w / h, 4)}
    seed = tuple(int(v) for v in np.unravel_index(int(sal.argmax()), sal.shape))
    core = _component(sal >= peak * CORE, seed)
    extent = _component(sal >= peak * EXTENT, seed)
    weights = np.where(core, sal, 0.0)
    yy, xx = np.mgrid[0:sh, 0:sw]
    total = float(weights.sum())
    x = float((weights * xx).sum() / total) + 0.5
    y = float((weights * yy).sum() / total) + 0.5
    r = math.sqrt(float(extent.sum()) / math.pi) / sh
    return {
        "x": round(min(1.0, max(0.0, x / sw)), 4),
        "y": round(min(1.0, max(0.0, y / sh)), 4),
        "r": round(min(0.5, max(0.06, r)), 4),
        "aspect": round(w / h, 4),
    }


async def ensure_cover_focals(db, ids: list[str] | None = None, force: bool = False) -> dict:
    """Calcola `hero_focal` per le copertine che non l'hanno (o l'hanno di una
    copertina precedente). Idempotente: si può richiamare a ogni avvio."""
    from media_cache import cached_object

    query: dict = {"hero_image_generated": {"$nin": [None, ""]}}
    if ids:
        query["id"] = {"$in": ids}
    done = skipped = failed = 0
    async for doc in db.stories.find(query, {"_id": 0, "id": 1, "hero_image_generated": 1, "hero_focal": 1}):
        path = doc["hero_image_generated"]
        current = doc.get("hero_focal") or {}
        if not force and current.get("src") == path:
            skipped += 1
            continue
        try:
            content, _ = await cached_object(path)
            focal = await run_in_threadpool(compute_focal, content)
        except Exception:
            failed += 1
            continue
        focal["src"] = path
        await db.stories.update_one({"id": doc["id"]}, {"$set": {"hero_focal": focal}})
        done += 1
    return {"computed": done, "unchanged": skipped, "failed": failed}


if __name__ == "__main__":
    import os
    from dotenv import load_dotenv
    from motor.motor_asyncio import AsyncIOMotorClient

    load_dotenv()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    force = "--force" in sys.argv

    async def main() -> None:
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        print(await ensure_cover_focals(db, args or None, force=force))
        client.close()

    asyncio.run(main())
