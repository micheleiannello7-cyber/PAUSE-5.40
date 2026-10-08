// PAUSE — preferenze del lettore (dimensione del testo dei capitoli), sul dispositivo.
import { useCallback, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

export type ReaderSize = "s" | "m" | "l" | "xl";
export const READER_SIZES: ReaderSize[] = ["s", "m", "l", "xl"];
export const READER_SCALE: Record<ReaderSize, number> = { s: 0.9, m: 1, l: 1.12, xl: 1.25 };

const KEY = "pause.reader.size";
let cached: ReaderSize | null = null;
const listeners = new Set<(s: ReaderSize) => void>();

async function load(): Promise<ReaderSize> {
  if (cached) return cached;
  const raw = await storage.getItem(KEY, "m");
  cached = READER_SIZES.includes(raw as ReaderSize) ? (raw as ReaderSize) : "m";
  return cached;
}

export function useReaderSize(): [ReaderSize, (s: ReaderSize) => void] {
  const [size, setSize] = useState<ReaderSize>(cached ?? "m");
  useEffect(() => {
    let alive = true;
    load().then((s) => { if (alive) setSize(s); });
    const l = (s: ReaderSize) => { if (alive) setSize(s); };
    listeners.add(l);
    return () => { alive = false; listeners.delete(l); };
  }, []);
  const update = useCallback((s: ReaderSize) => {
    cached = s;
    storage.setItem(KEY, s);
    listeners.forEach((l) => l(s));
  }, []);
  return [size, update];
}
