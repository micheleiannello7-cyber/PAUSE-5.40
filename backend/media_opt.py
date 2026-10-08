"""Mobile-optimised cover encoding (WebP, content-addressed paths).

Covers are stored twice: a hero (≤1200px, for the reader/home card) and a
thumbnail (≤600px, for lists). Both WebP at high quality — typically 5–10×
smaller than the PNG/JPEG originals with no visible loss on phone screens.
"""
import hashlib
import io

from PIL import Image, ImageOps

from storage import put_object, APP_NAME

HERO_MAX = 1200
THUMB_MAX = 600
QUALITY = 84


def encode_webp(raw: bytes, max_side: int) -> bytes:
    image = Image.open(io.BytesIO(raw))
    # Sorgente già WebP entro il limite (es. backend/covers pre-ottimizzate):
    # nessuna ricompressione, si usa il file così com'è.
    if (image.format == "WEBP" and max(image.size) <= max_side
            and image.getexif().get(274, 1) == 1):
        return raw
    image = ImageOps.exif_transpose(image)
    image = image.convert("RGB") if image.mode not in ("RGB", "RGBA") else image
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    image.save(out, "WEBP", quality=QUALITY, method=6)
    return out.getvalue()


def cutout_png(raw: bytes, tight: bool = False) -> bytes:
    """Oggetto 3D su sfondo nero → PNG RGBA con lo sfondo reso trasparente
    (stesso keying delle icone CTA), per usarlo sopra superfici colorate."""
    from generate_cta_icons import fit_square, key_out_background
    from collections import deque
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    out = io.BytesIO()
    # Flood-fill più tollerante: la sorgente 3D ha un contact-shadow bakeato
    # che sfuma dal nero puro a un grigio scuro; con tol=40 il transiente del
    # grigio sopravviveva come alone sotto l'oggetto. Il wireframe colorato
    # resta ben distante da questa soglia.
    cutout = key_out_background(image, tol=90)
    # Seconda passata: pixel sopravvissuti che sono scuri (RGB medio < 110) e
    # connessi ai bordi dell'immagine, SOLO nella metà bassa (dove abita il
    # contact-shadow 3D) sono residuo → alfa=0. L'oggetto wireframe colorato
    # resta ben distante da questa soglia, ma per sicurezza non tocchiamo mai
    # la metà alta dove alcune parti dell'oggetto possono essere scure.
    w, h = cutout.size
    px = cutout.load()
    seen = bytearray(w * h)
    q: deque = deque()
    y_floor = int(h * 0.45)  # inizio della zona "pavimento"
    for x in range(w):
        q.append((x, h - 1))
    for y in range(y_floor, h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < y_floor or x >= w or y >= h or seen[y * w + x]:
            continue
        seen[y * w + x] = 1
        r, g, b, a = px[x, y]
        if a == 0 or (r + g + b) / 3 < 110:
            px[x, y] = (0, 0, 0, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # Soglia dura sull'alfa residua: cancella l'alone grigio del bordo del
    # flood-fill morbido. 1 px di AA sul bordo preserva la nitidezza senza
    # scalettature.
    alpha = cutout.getchannel("A").point(lambda a: 255 if a > 200 else (0 if a < 160 else int((a - 160) * 255 / 40)))
    cutout.putalpha(alpha)
    # Terza passata: nella metà bassa dell'immagine qualsiasi pixel con alfa
    # parziale è residuo di riflesso/specchio (lo stesso colore dell'oggetto
    # ma sfumato verso trasparente) → alfa=0. L'oggetto proprio ha alfa=255
    # pieno; il bordo AA dell'oggetto sta sopra la soglia y_floor e non viene
    # toccato.
    px = cutout.load()
    w, h = cutout.size
    y_floor = int(h * 0.55)
    for y in range(y_floor, h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 220:
                px[x, y] = (0, 0, 0, 0)
    # Quarta passata: dopo le pulizie, il mirror che sopravvive è un BLOB
    # staccato sotto l'oggetto principale (sorgenti 3D in studio: oggetto +
    # specchio del pavimento, separati da una riga completamente trasparente).
    # Tagliamo tutto quello che sta sotto la prima riga vuota SOLO se:
    #  (a) l'oggetto sopra la riga ha massa significativa,
    #  (b) il contenuto sotto è nettamente minore del contenuto sopra (mirror).
    # Oggetti multi-parte (es. gesto a due mani con un sottile stacco) hanno
    # il "sotto" denso quanto il "sopra" → non vengono tagliati.
    row_opaque_count = [0] * h
    for y in range(h):
        c = 0
        for x in range(w):
            if px[x, y][3] > 0:
                c += 1
        row_opaque_count[y] = c
    total_above = 0
    best_cut = None
    for y in range(h):
        if row_opaque_count[y] > 0:
            total_above += row_opaque_count[y]
        elif total_above > w * h * 0.02:  # oggetto con massa reale
            below = sum(row_opaque_count[y + 1:])
            if below > 0 and below < total_above * 0.5:
                best_cut = y
                break
    if best_cut is not None:
        for yy in range(best_cut, h):
            for xx in range(w):
                px[xx, yy] = (0, 0, 0, 0)
    if tight:
        bbox = cutout.getchannel("A").point(lambda alpha: 255 if alpha > 8 else 0).getbbox()
        if bbox:
            cutout = cutout.crop(bbox)
        cutout = ImageOps.expand(cutout, border=max(2, round(max(cutout.size) * 0.015)))
        cutout.thumbnail((320, 320), Image.Resampling.LANCZOS)
    else:
        cutout = fit_square(cutout, size=320)
    cutout.save(out, "PNG", optimize=True)
    return out.getvalue()


def source_digest(raw: bytes) -> str:
    return hashlib.sha256(raw).hexdigest()[:12]


def _row_is_black(px, w: int, y: int) -> bool:
    step = max(1, w // 40)
    vals = [sum(px[x, y]) / 3 for x in range(0, w, step)]
    mean = sum(vals) / len(vals)
    var = sum((v - mean) ** 2 for v in vals) / len(vals)
    return mean < 16.0 and var ** 0.5 < 12.0


def crop_letterbox(raw: bytes) -> bytes:
    """Rimuove bande nere piene (letterbox) in alto/basso cotte dentro le
    copertine AI: il generatore lascia "spazio negativo" che esce nero pieno e
    in app sembra una card tagliata. L'app disegna da sé lo scrim del titolo,
    quindi la banda va solo ritagliata. Ritaglio prudente: solo righe quasi
    pure nere e uniformi, e solo se restano un ritratto valido (lato ≥ 768)."""
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
        rgb = image.convert("RGB")
    except Exception:  # noqa: BLE001
        return raw
    w, h = rgb.size
    px = rgb.load()
    top = 0
    for y in range(0, int(h * 0.5)):
        if _row_is_black(px, w, y):
            top += 1
        else:
            break
    bot = 0
    for y in range(h - 1, int(h * 0.5), -1):
        if _row_is_black(px, w, y):
            bot += 1
        else:
            break
    if top + bot < h * 0.03:
        return raw
    new_h = h - top - bot
    if new_h < 768 or new_h <= w:
        return raw
    out = io.BytesIO()
    rgb.crop((0, top, w, h - bot)).save(out, "WEBP", quality=90, method=6)
    return out.getvalue()


def upload_cover(story_id: str, raw: bytes) -> dict:
    """Encode + upload hero and thumb. Returns the Mongo fields to set.
    Le bande nere letterbox eventualmente presenti vengono ritagliate qui, così
    OGNI copertina servita (generate_covers, reduce_faces, covers_sync) è pulita."""
    raw = crop_letterbox(raw)
    digest = source_digest(raw)
    hero = encode_webp(raw, HERO_MAX)
    thumb = encode_webp(raw, THUMB_MAX)
    hero_path = f"{APP_NAME}/hero/{story_id}-{digest}.webp"
    thumb_path = f"{APP_NAME}/hero/{story_id}-{digest}-thumb.webp"
    put_object(hero_path, hero, "image/webp")
    put_object(thumb_path, thumb, "image/webp")
    return {
        "hero_image_generated": hero_path,
        "hero_image_thumb": thumb_path,
        "hero_source_digest": digest,
        "hero_bytes": {"hero": len(hero), "thumb": len(thumb), "source": len(raw)},
    }


def upload_avatar(user_id: str, raw: bytes) -> dict:
    """Foto profilo: raddrizza (EXIF), ritaglia al quadrato centrale, 320px,
    WebP. Path versionato dal digest → URL immutabile e cache-friendly."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert("RGB")
    side = min(img.size)
    left, top = (img.width - side) // 2, (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side)).resize((320, 320), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=86, method=6)
    data = buf.getvalue()
    digest = hashlib.sha256(data).hexdigest()[:12]
    path = f"{APP_NAME}/avatar/{user_id}/{digest}.webp"
    put_object(path, data, "image/webp")
    return {"avatar_path": path, "avatar_version": digest}
