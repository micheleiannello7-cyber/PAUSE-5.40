// PAUSE — scelta della foto profilo dalla galleria + upload.
// Permessi: controllo → spiegazione contestuale → richiesta (max una seconda
// volta se `canAskAgain`) → altrimenti "Apri impostazioni". Un rifiuto non
// blocca nulla: l'avatar resta l'iniziale del nome.
import { useCallback, useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "@/src/api";
import { useI18n } from "@/src/i18n";

export function useAvatarPicker(userId: string | null | undefined) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [status, requestPermission] = ImagePicker.useMediaLibraryPermissions();
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (b64: string) => api.setAvatar(userId!, b64),
    onSuccess: (user) => qc.setQueryData(["user", userId], user),
    onError: () => setError(t.avatar_upload_failed),
  });
  const remove = useMutation({
    mutationFn: () => api.removeAvatar(userId!),
    onSuccess: (user) => qc.setQueryData(["user", userId], user),
  });

  const launch = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true, exif: false,
    });
    const asset = res.assets?.[0];
    if (res.canceled || !asset?.base64) return;
    setError(null);
    upload.mutate(asset.base64);
  }, [upload]);

  const explainThenAsk = useCallback(() => new Promise<boolean>((resolve) => {
    if (Platform.OS === "web") { resolve(true); return; }
    Alert.alert(t.avatar_perm_title, t.avatar_perm_body, [
      { text: t.cancel_label, style: "cancel", onPress: () => resolve(false) },
      { text: t.continue_label, onPress: () => resolve(true) },
    ]);
  }), [t]);

  const pick = useCallback(async () => {
    if (!userId) return;
    let perm = status ?? await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (!perm.canAskAgain) {
        Alert.alert(t.avatar_perm_title, t.avatar_perm_denied, [
          { text: t.cancel_label, style: "cancel" },
          { text: t.open_settings, onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      if (!(await explainThenAsk())) return;
      perm = await requestPermission();
      if (!perm.granted) return;
    }
    await launch();
  }, [userId, status, requestPermission, explainThenAsk, launch, t]);

  return { pick, remove: () => remove.mutate(), busy: upload.isPending || remove.isPending, error };
}
