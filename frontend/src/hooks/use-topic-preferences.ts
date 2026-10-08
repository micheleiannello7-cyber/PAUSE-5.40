import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "@/src/haptics";
import { api } from "@/src/api";
import { StoryKind } from "@/src/components/kind-icon";
import { toggleInterest } from "@/src/components/category-grid";
import { toggleContentMode } from "@/src/components/onboarding-modes";

// Autosave degli argomenti/formati del tab Esplora.
// I tocchi aggiornano SUBITO lo stato locale (nessun tocco perso) e il
// salvataggio viaggia in una coda: se arriva un nuovo tocco mentre la
// scrittura è in corso, al termine si invia l'ultimo stato. Così, scegliendo
// a mano tutte le categorie, scatta in modo affidabile l'argomento ESPLORA.
// `onLocked` fires when a free reader taps the Premium-only "mini lessons" mode.
export function useTopicPreferences(userId: string | null, onLocked?: () => void) {
  const qc = useQueryClient();
  const userQuery = useQuery({ queryKey: ["user", userId], queryFn: () => api.user(userId!), enabled: !!userId });
  const { data: user } = userQuery;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modes, setModes] = useState<Set<StoryKind>>(new Set(["stories", "lessons"]));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Riferimenti sincroni: i tocchi rapidi partono sempre dall'ultimo stato.
  const selectedRef = useRef(selected);
  const modesRef = useRef(modes);
  const editing = useRef(false);
  const inFlight = useRef(false);
  const pendingInterests = useRef<string[] | null>(null);
  const pendingModes = useRef<StoryKind[] | null>(null);

  // Idratazione dal backend solo finché l'utente non inizia a modificare:
  // dopo, lo stato locale non viene più sovrascritto dalle risposte in volo.
  useEffect(() => {
    if (!user || editing.current) return;
    const s = new Set(user.interests);
    const m = new Set(user.content_modes as StoryKind[]);
    selectedRef.current = s;
    modesRef.current = m;
    setSelected(s);
    setModes(m);
  }, [user]);

  const flush = () => {
    if (inFlight.current || !userId) return;
    if (pendingInterests.current == null && pendingModes.current == null) return;
    inFlight.current = true;
    setSaving(true);
    (async () => {
      try {
        if (pendingInterests.current != null) {
          const payload = pendingInterests.current; pendingInterests.current = null;
          qc.setQueryData(["user", userId], await api.setInterests(userId, payload));
        }
        if (pendingModes.current != null) {
          const payload = pendingModes.current; pendingModes.current = null;
          qc.setQueryData(["user", userId], await api.setContentModes(userId, payload));
        }
        setSaveError(false);
        qc.invalidateQueries({ queryKey: ["discover-next"] });
        qc.invalidateQueries({ queryKey: ["browse"] });
      } catch {
        setSaveError(true);
      } finally {
        inFlight.current = false;
        // Qualcosa è arrivato mentre salvavamo? Continua con l'ultimo stato.
        if (pendingInterests.current != null || pendingModes.current != null) flush();
        else setSaving(false);
      }
    })();
  };

  const onToggleCategory = (id: string, allIds?: string[]) => {
    if (!userId) return;
    editing.current = true;
    Haptics.selectionAsync().catch(() => {});
    const next = toggleInterest(selectedRef.current, id, allIds);
    selectedRef.current = next;
    setSelected(next);
    pendingInterests.current = Array.from(next);
    flush();
  };

  // Le mini lezioni sono solo Premium: per l'utente base il tocco apre il paywall.
  const onToggleMode = (mode: StoryKind) => {
    if (!userId) return;
    if (mode === "lessons" && !user?.is_premium) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      onLocked?.();
      return;
    }
    const next = toggleContentMode(modesRef.current, mode);
    if (next.size === modesRef.current.size) return;
    editing.current = true;
    Haptics.selectionAsync().catch(() => {});
    modesRef.current = next;
    setModes(next);
    pendingModes.current = Array.from(next);
    flush();
  };

  return { selected, modes, onToggleCategory, onToggleMode, saving, saveError, userQuery };
}
