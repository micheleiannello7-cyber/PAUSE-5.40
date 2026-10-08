"""PAUSE — identità sonora dell'interfaccia (solo feedback/transizioni, non la lettura).

Genera 4 effetti brevi e discreti in assets/sounds/*.wav con una firma comune:
toni morbidi (seno + poche armoniche pari, attacco lento), un leggero "respiro"
d'aria (rumore filtrato) e la stessa tavolozza tonale in Re (D). Niente beep,
click o notifiche: texture ariose e organiche, in linea con il glassmorphism
e le transizioni lente dell'app.

  enter.wav     Home → lettura: respiro ascendente, si "entra" nel racconto (~0,7 s)
  return.wav    lettura → Home: lo stesso suono al contrario (specchiato)
  complete.wav  fine storia → "Da ricordare": due note che si posano (~1,3 s)
  tick.wav      card al centro: micro-tocco quasi impercettibile (~0,12 s)

Usage: python3 scripts/make_sounds.py
"""
import math
import wave
from pathlib import Path

import numpy as np

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "assets" / "sounds"
D4, A4, D5, FS5, D3 = 293.66, 440.0, 587.33, 739.99, 146.83


def t_axis(seconds: float) -> np.ndarray:
    return np.arange(int(SR * seconds)) / SR


def env(n: int, attack: float, release: float, curve: float = 2.0) -> np.ndarray:
    """Inviluppo morbido: attacco e rilascio a coseno (niente fronti ripidi)."""
    a, r = int(SR * attack), int(SR * release)
    e = np.ones(n)
    if a > 0:
        e[:a] = (1 - np.cos(np.linspace(0, math.pi, a))) / 2
    if r > 0:
        e[-r:] = np.minimum(e[-r:], (1 + np.cos(np.linspace(0, math.pi, r))) / 2)
    return e ** curve


def tone(freq, seconds: float, glide_to: float | None = None) -> np.ndarray:
    """Seno "di vetro": fondamentale + 2ª e 3ª armonica molto attenuate, con glide opzionale."""
    t = t_axis(seconds)
    f = np.full_like(t, freq) if glide_to is None else freq * (glide_to / freq) ** ((1 - np.cos(np.pi * t / seconds)) / 2)
    phase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(phase) + 0.18 * np.sin(2 * phase) + 0.05 * np.sin(3 * phase)


def breath(seconds: float, lo: float, hi: float, seed: int = 7) -> np.ndarray:
    """Soffio d'aria: rumore bianco filtrato a banda (FFT) tra lo e hi Hz."""
    rng = np.random.default_rng(seed)
    n = int(SR * seconds)
    spec = np.fft.rfft(rng.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    band = np.exp(-((np.log(np.maximum(freqs, 1)) - np.log(math.sqrt(lo * hi))) ** 2) / (2 * (0.45) ** 2))
    band[(freqs < lo * 0.5) | (freqs > hi * 2)] = 0
    out = np.fft.irfft(spec * band, n)
    return out / (np.max(np.abs(out)) + 1e-9)


def normalize(x: np.ndarray, peak: float) -> np.ndarray:
    return x / (np.max(np.abs(x)) + 1e-9) * peak


def write(name: str, x: np.ndarray) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    # Dissolvenze di sicurezza (5 ms) contro qualsiasi click ai bordi.
    x = x * env(len(x), 0.005, 0.005, 1.0)
    data = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"{name}: {len(x) / SR:.2f}s")


def make_enter() -> np.ndarray:
    """Respiro ascendente: D4→A4 in glide, ottava che affiora, soffio che si apre."""
    dur = 0.72
    n = int(SR * dur)
    low = tone(D4, dur, glide_to=A4) * env(n, 0.16, 0.40)
    shimmer = tone(D5, dur) * env(n, 0.34, 0.30) * 0.28
    air = breath(dur, 1800, 5200) * env(n, 0.22, 0.36) * 0.22
    return normalize(low + shimmer + air, 0.6)


def make_complete() -> np.ndarray:
    """Conclusione: Fa#5 che si posa su Re5, con un Re grave caldo sotto — una "chiusura di pagina"."""
    dur = 1.35
    n = int(SR * dur)
    bed = tone(D3, dur) * env(n, 0.30, 0.80) * 0.55
    first = tone(FS5, dur) * np.roll(env(n, 0.10, 0.95), 0) * 0.5
    second = np.zeros(n)
    off = int(SR * 0.30)
    seg = tone(D5, dur - 0.30) * env(n - off, 0.10, 0.85) * 0.62
    second[off:] = seg
    air = breath(dur, 1500, 4200, seed=11) * env(n, 0.25, 0.9) * 0.14
    return normalize(bed + first + second + air, 0.6)


def make_tick() -> np.ndarray:
    """Micro-tocco: Re5 brevissimo con decadimento morbido e un filo d'aria."""
    dur = 0.12
    n = int(SR * dur)
    body = tone(D5, dur) * env(n, 0.006, 0.09, 1.6)
    air = breath(dur, 2500, 6000, seed=3) * env(n, 0.004, 0.08) * 0.25
    return normalize(body + air, 0.45)


if __name__ == "__main__":
    enter = make_enter()
    write("enter.wav", enter)
    # Ritorno: letteralmente lo stesso suono al contrario (glide A4→D4, il soffio si richiude).
    write("return.wav", enter[::-1].copy())
    write("complete.wav", make_complete())
    write("tick.wav", make_tick())
