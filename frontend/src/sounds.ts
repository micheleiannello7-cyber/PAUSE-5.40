// PAUSE — identità sonora dell'interfaccia: pochi feedback brevi e discreti
// (transizioni e conferme), MAI la lettura/narrazione, che ha il suo player.
// Interruttore globale "Effetti sonori" in Profilo → Impostazioni, salvato in
// locale e letto all'avvio (stesso schema di `haptics.ts`).
// I file sono generati da `scripts/make_sounds_eleven.py` (ElevenLabs Sound
// Effects, mood calmo/meditativo: respiri ariosi e una campana tibetana calda).
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AudioPlayer, createAudioPlayer } from "expo-audio";
import * as Haptics from "./haptics";

const KEY = "pause.sounds.v1";
let enabled = true;
const listeners = new Set<(v: boolean) => void>();

AsyncStorage.getItem(KEY).then((raw) => {
  if (raw === "0") { enabled = false; listeners.forEach((l) => l(false)); }
}).catch(() => {});

// Volume complessivo degli effetti (0..1): moltiplicatore sui volumi base di
// ogni suono. Regolabile da Profilo → Impostazioni e salvato in locale.
const VOLUME_KEY = "pause.sounds.volume.v1";
let volumeMul = 1;
const volumeListeners = new Set<(v: number) => void>();

AsyncStorage.getItem(VOLUME_KEY).then((raw) => {
  const v = raw == null ? NaN : parseFloat(raw);
  if (!Number.isNaN(v)) { volumeMul = Math.max(0, Math.min(1, v)); volumeListeners.forEach((l) => l(volumeMul)); }
}).catch(() => {});

export function getSoundsVolume() { return volumeMul; }

export async function setSoundsVolume(value: number, persist = true) {
  volumeMul = Math.max(0, Math.min(1, value));
  volumeListeners.forEach((l) => l(volumeMul));
  if (persist) { try { await AsyncStorage.setItem(VOLUME_KEY, String(volumeMul)); } catch {} }
}

export function useSoundsVolume(): [number, (v: number, persist?: boolean) => void] {
  const [value, setValue] = useState(volumeMul);
  useEffect(() => {
    volumeListeners.add(setValue);
    setValue(volumeMul);
    return () => { volumeListeners.delete(setValue); };
  }, []);
  return [value, setSoundsVolume];
}

export function isSoundsEnabled() { return enabled; }

export async function setSoundsEnabled(value: boolean) {
  enabled = value;
  listeners.forEach((l) => l(value));
  try { await AsyncStorage.setItem(KEY, value ? "1" : "0"); } catch {}
}

export function useSoundsEnabled(): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(enabled);
  useEffect(() => {
    listeners.add(setValue);
    setValue(enabled);
    return () => { listeners.delete(setValue); };
  }, []);
  return [value, setSoundsEnabled];
}

export type UiSound = "enter" | "return" | "complete" | "tick" | "favorite";

// Pacchetto "Zen" (acqua/respiro + campana tibetana), scelto dall'utente tra le
// varianti provate; file generati da scripts/make_sounds_eleven.py.
const SOURCES: Record<UiSound, number> = {
  enter: require("../assets/sounds/zen/enter.mp3"),
  return: require("../assets/sounds/zen/return.mp3"),
  complete: require("../assets/sounds/zen/complete.mp3"),
  tick: require("../assets/sounds/zen/tick.mp3"),
  favorite: require("../assets/sounds/zen/favorite.mp3"),
};
// Volume base per suono (×volumeMul). Più presenti di prima: gli effetti ora si
// sentono bene anche senza alzare lo slider al massimo.
const VOLUME: Record<UiSound, number> = { enter: 0.95, return: 0.95, complete: 0.95, tick: 0.5, favorite: 0.7 };
// Scorrimento veloce: al massimo un tocco ogni tanto, mai una raffica.
const MIN_GAP_MS: Partial<Record<UiSound, number>> = { tick: 140 };

// Un player per suono (niente sovrapposizioni).
const players: Partial<Record<UiSound, AudioPlayer>> = {};
const lastPlayed: Partial<Record<UiSound, number>> = {};

function player(name: UiSound): AudioPlayer {
  let p = players[name];
  if (!p) {
    p = createAudioPlayer(SOURCES[name]);
    p.volume = VOLUME[name];
    players[name] = p;
  }
  return p;
}

// Vibrazione leggera abbinata a ogni effetto (feedback "premium"). È
// indipendente dall'interruttore dei suoni ma rispetta quello della vibrazione:
// le funzioni di `haptics.ts` sono no-op quando la vibrazione è spenta in Profilo.
function hapticFor(name: UiSound) {
  switch (name) {
    case "enter":
    case "return":
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      break;
    case "complete":
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      break;
    case "tick":
      Haptics.selectionAsync().catch(() => {});
      break;
  }
}

/** Riproduce un effetto dall'inizio (un solo player per suono: niente sovrapposizioni). */
export function play(name: UiSound) {
  const now = Date.now();
  const gap = MIN_GAP_MS[name];
  if (gap && now - (lastPlayed[name] ?? 0) < gap) return;
  lastPlayed[name] = now;
  // Vibrazione abbinata (stesso istante del suono, stesso throttle).
  hapticFor(name);
  if (!enabled) return;
  try {
    const p = player(name);
    p.volume = VOLUME[name] * volumeMul;
    p.seekTo(0).then(() => p.play()).catch(() => {});
  } catch {}
}

/** Precarica i player del pacchetto attivo (prima apertura senza ritardo). */
export function preload() {
  (Object.keys(VOLUME) as UiSound[]).forEach((n) => { try { player(n); } catch {} });
}
