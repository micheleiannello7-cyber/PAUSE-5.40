// PAUSE — invito gentile (non bloccante) all'accesso per gli ospiti, dopo
// qualche storia letta. "Non ora" lo nasconde per una settimana.
import { useCallback, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import { useAuth } from "@/src/auth";

const KEY = "pause.guest_invite.dismissed_at";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const GUEST_INVITE_AFTER = 2;

export function useGuestInvite(completedCount: number | undefined) {
  const auth = useAuth();
  const [snoozed, setSnoozed] = useState(true);
  useEffect(() => {
    storage.getItem(KEY, 0).then((at) => setSnoozed(typeof at === "number" && Date.now() - at < SNOOZE_MS));
  }, []);
  const dismiss = useCallback(() => {
    setSnoozed(true);
    storage.setItem(KEY, Date.now());
  }, []);
  const show = auth.status === "guest" && !snoozed && (completedCount ?? 0) >= GUEST_INVITE_AFTER;
  return { show, dismiss };
}
