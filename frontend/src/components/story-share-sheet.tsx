// PAUSE — Bottom sheet di condivisione: anteprima della card (Storia 9:16 o
// Post 4:5), poi la card a piena risoluzione viene catturata e condivisa.
import { useRef, useState } from "react";
import { View, Text, Pressable, Modal, Share, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@react-native-vector-icons/ionicons";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";

import { Story } from "@/src/api";
import { makeStyles, useTheme, spacing, radius, typography, ThemeColors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { GradientButton } from "@/src/components/gradient-button";
import { StoryShareCard, ShareFormat, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT } from "@/src/components/story-share-card";

const PREVIEW_H = 340;
const EXPORT_W = 1080;

export function StoryShareSheet({ story, visible, onClose }: { story: Story; visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [format, setFormat] = useState<ShareFormat>("story");
  const [busy, setBusy] = useState(false);
  const captureTarget = useRef<View>(null);
  const cardH = SHARE_CARD_HEIGHT[format];
  const scale = PREVIEW_H / cardH;

  const onShare = async () => {
    setBusy(true);
    try {
      if (Platform.OS !== "web" && captureTarget.current && (await Sharing.isAvailableAsync())) {
        const uri = await captureRef(captureTarget, {
          format: "png", quality: 1, result: "tmpfile",
          width: EXPORT_W, height: Math.round((EXPORT_W * cardH) / SHARE_CARD_WIDTH),
        });
        await Sharing.shareAsync(uri, { dialogTitle: t.share, mimeType: "image/png", UTI: "public.png" });
      } else {
        await Share.share({ message: `${story.title} — ${t.share_suffix}` });
      }
      onClose();
    } catch {}
    setBusy(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} testID="share-sheet-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]} testID="share-sheet">
        <View style={styles.handle} />
        <View style={styles.head}>
          <Text style={styles.title}>{t.share_sheet_title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.close} testID="share-sheet-close">
            <Ionicons name="close" size={18} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.segment}>
          {(["story", "post"] as ShareFormat[]).map((f) => {
            const on = f === format;
            return (
              <Pressable key={f} onPress={() => setFormat(f)} style={[styles.segBtn, on && styles.segBtnOn]} testID={`share-format-${f}`}
                accessibilityRole="button" accessibilityState={{ selected: on }}>
                <Ionicons name={f === "story" ? "phone-portrait-outline" : "square-outline"} size={15} color={on ? colors.brand : colors.muted} />
                <Text style={[styles.segText, on && { color: colors.onSurface }]}>{f === "story" ? t.share_format_story : t.share_format_post}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.previewBox} testID="share-preview">
          <View style={{ width: SHARE_CARD_WIDTH * scale, height: PREVIEW_H, overflow: "hidden", borderRadius: radius.md }}>
            <View style={{ width: SHARE_CARD_WIDTH, height: cardH, transform: [{ translateX: -(SHARE_CARD_WIDTH * (1 - scale)) / 2 }, { translateY: -(cardH * (1 - scale)) / 2 }, { scale }] }}>
              <StoryShareCard story={story} format={format} />
            </View>
          </View>
        </View>
        <Text style={styles.hint}>{t.share_hint}</Text>

        <GradientButton label={busy ? "…" : t.share_cta} icon="share-social" onPress={onShare} disabled={busy} testID="share-sheet-confirm" />
        {busy ? <ActivityIndicator style={styles.spinner} color={colors.brand} /> : null}

        {/* Card a piena dimensione fuori schermo: è questa che viene catturata. */}
        <View style={styles.hidden} pointerEvents="none">
          <View ref={captureTarget} collapsable={false}>
            <StoryShareCard story={story} format={format} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors: ThemeColors) => ({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.onSurface, fontFamily: typography.displayBold, fontSize: 18 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  segment: { flexDirection: "row", gap: spacing.sm },
  segBtn: {
    flex: 1, height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border,
  },
  segBtnOn: { borderColor: colors.brand },
  segText: { color: colors.muted, fontFamily: typography.bodyBold, fontSize: 13 },
  previewBox: { alignItems: "center", justifyContent: "center", height: PREVIEW_H },
  hint: { color: colors.muted, fontFamily: typography.body, fontSize: 12, textAlign: "center" },
  spinner: { position: "absolute", bottom: 0, alignSelf: "center" },
  hidden: { position: "absolute", left: -4000, top: 0, width: SHARE_CARD_WIDTH },
}));
