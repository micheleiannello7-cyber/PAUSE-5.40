// PAUSE — tema icone ("holo" = Ologramma, default · "3d" = 3D Realistico), persistito sul device.
import { useCallback, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

export type IconFamily = "holo" | "3d";
const KEY = "pause.icon.family";
const DEFAULT: IconFamily = "holo";

let cached: IconFamily | null = null;
const listeners = new Set<(f: IconFamily) => void>();

async function load(): Promise<IconFamily> {
  if (cached) return cached;
  const raw = await storage.getItem(KEY, DEFAULT);
  cached = raw === "3d" ? "3d" : "holo";
  return cached;
}

export async function setIconFamily(f: IconFamily) {
  cached = f;
  await storage.setItem(KEY, f);
  listeners.forEach((l) => l(f));
}

export function useIconFamily(): [IconFamily, (f: IconFamily) => Promise<void>] {
  const [family, setFamily] = useState<IconFamily>(cached ?? DEFAULT);
  useEffect(() => {
    let alive = true;
    load().then((f) => { if (alive) setFamily(f); });
    const l = (f: IconFamily) => { if (alive) setFamily(f); };
    listeners.add(l);
    return () => { alive = false; listeners.delete(l); };
  }, []);
  const update = useCallback((f: IconFamily) => setIconFamily(f), []);
  return [family, update];
}
