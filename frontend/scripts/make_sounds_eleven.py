"""PAUSE — generazione di 3 PACCHETTI sonori UI molto diversi con ElevenLabs
Sound Effects, così da poterli provare e scegliere nelle Impostazioni.

Ogni pacchetto contiene i 4 effetti dell'interfaccia (enter, return, complete,
tick) e viene salvato in assets/sounds/<pack>/<nome>.mp3. expo-audio riproduce
nativamente mp3, quindi nessuna conversione è necessaria. La chiave resta in
variabile d'ambiente, mai nel repo.

Pacchetti:
  v1  Zen / Acqua & Respiro   — ambient, naturale, meditativo
  v2  Cristallo / Tech premium — cristallino, luminoso, pulito (stile iOS)
  v3  Legno caldo / Organico   — kalimba/marimba, tocchi in legno, caldo

Usage:
  ELEVEN_API_KEY=... python3 scripts/make_sounds_eleven.py [v1 v2 v3] [nome ...]
"""
import os
import sys
from pathlib import Path

from elevenlabs import ElevenLabs

OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"

# (prompt, durata_sec, prompt_influence)
PACKS = {
    "v1": {  # Zen / Acqua & Respiro
        # Specchio ascendente di "return": stesso timbro (respiro arioso + lieve
        # swell d'acqua) ma in salita, per entrare nella lettura.
        "enter": (
            "Soft calm airy inhale rising, gentle warm ambient water swell ascending smoothly, "
            "mirror twin of a soft exhale but going up, meditation app opening a story, "
            "soothing and present, no clicks, no beeps, no percussion",
            1.1, 0.55,
        ),
        "return": (
            "Soft calm airy exhale with a low gentle water swell fading, meditation app closing and going back, "
            "warm ambient descending, soothing, no clicks, no beeps, no percussion",
            1.1, 0.55,
        ),
        "complete": (
            "Beautiful warm shimmering chime blooming softly, gentle glassy harp-like sparkle resolving in peace, "
            "dreamy soft reverb tail fading slowly, calm meditation reward, no harsh attack, no melody",
            2.2, 0.6,
        ),
        "tick": (
            "Delicate soft warm water droplet with a tiny gentle shimmer, smooth calm UI tick for scrolling cards, "
            "very short and pretty, no hard click",
            0.5, 0.5,
        ),
        "favorite": (
            "Delicate soft warm chime sparkle, single gentle bell with a short airy shimmer, "
            "calm pleasant bookmark saved confirmation, light and soothing, short",
            0.9, 0.6,
        ),
    },
    "v2": {  # Cristallo / Tech premium
        "enter": (
            "Bright clean crystalline glassy swipe rising up, premium iOS UI screen transition, "
            "sparkling glass bell shimmer, crisp polished and modern, short, no voice, no percussion",
            0.9, 0.65,
        ),
        "return": (
            "Bright clean crystalline glassy swipe going down, premium iOS UI transition back, "
            "light glass shimmer descending, crisp polished and modern, short, no voice, no percussion",
            0.9, 0.65,
        ),
        "complete": (
            "Sparkling crystal bell chime success tone, bright glassy positive confirmation, "
            "premium clean and polished with a gentle shimmering tail, no harsh attack",
            1.8, 0.65,
        ),
        "tick": (
            "Crisp tiny glass click tick, clean minimal premium UI micro tap, bright and short, single hit",
            0.5, 0.6,
        ),
        "favorite": (
            "Bright delicate crystal sparkle chime, tiny glassy bell confirmation, clean premium bookmark saved, short and pleasant",
            0.9, 0.6,
        ),
    },
    "v3": {  # Legno caldo / Organico
        "enter": (
            "Warm wooden kalimba note rising gently, cozy organic UI opening, soft mallet on wood, "
            "round warm and natural, short, no clicks, no beeps",
            0.9, 0.6,
        ),
        "return": (
            "Warm wooden kalimba note descending gently, cozy organic UI going back, soft mallet on wood, "
            "round warm and natural, short, no clicks, no beeps",
            0.9, 0.6,
        ),
        "complete": (
            "Warm marimba wooden chord resolving gently and blooming, cozy organic completion sound, "
            "soft rounded mallets, natural warm fade, no harsh attack",
            2.0, 0.6,
        ),
        "tick": (
            "Soft warm wooden knock tick, tiny rounded kalimba pluck, cozy organic UI micro tap, single short hit, warm",
            0.5, 0.55,
        ),
        "favorite": (
            "Warm wooden double kalimba pluck, cozy organic bookmark saved confirmation, soft rounded and pleasant, short",
            0.9, 0.55,
        ),
    },
}


def main() -> None:
    client = ElevenLabs(api_key=os.environ["ELEVEN_API_KEY"])
    args = sys.argv[1:]
    packs = [a for a in args if a in PACKS] or list(PACKS)
    names = [a for a in args if a not in PACKS] or ["enter", "return", "complete", "tick", "favorite"]
    for pack in packs:
        dest = OUT / ("zen" if pack == "v1" else pack)
        dest.mkdir(parents=True, exist_ok=True)
        for name in names:
            prompt, seconds, influence = PACKS[pack][name]
            audio = client.text_to_sound_effects.convert(
                text=prompt,
                duration_seconds=seconds,
                prompt_influence=influence,
                output_format="mp3_44100_128",
            )
            path = dest / f"{name}.mp3"
            with open(path, "wb") as f:
                for chunk in audio:
                    f.write(chunk)
            print(f"{path} {path.stat().st_size} bytes", flush=True)


if __name__ == "__main__":
    main()
