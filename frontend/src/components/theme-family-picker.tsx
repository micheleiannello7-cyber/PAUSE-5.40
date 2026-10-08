// PAUSE — Profilo → Temi: tre famiglie di icone, ognuna con una fila di icone
// di riferimento disegnate nel proprio stile (Ologramma · 3D Realistico · Gemstone 3D).
import { ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { Image } from "expo-image";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useRouter } from "expo-router";

import { makeStyles, useTheme, spacing, radius, typography, withAlpha } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { IconFamily, isPremiumFamily } from "@/src/icon-theme";
import { usePremiumFlag } from "@/src/premium";
import { HoloSymbol, HoloName } from "./holo-icons";
import { GemSymbol } from "./gem-icons";

const REF: HoloName[] = ["bulb", "books", "heart", "bookmark", "headphones", "clock"];
const ART_3D: Record<string, number> = {
  bulb: require("../../assets/images/kind-lesson.png"),
  books: require("../../assets/images/kind-bulb.png"),
  heart: require("../../assets/images/act-heart-active.png"),
  bookmark: require("../../assets/images/act-bookmark-active.png"),
  headphones: require("../../assets/images/kind-headphones.png"),
  clock: require("../../assets/images/kind-clock.png"),
};

function refIcon(family: IconFamily, name: HoloName): ReactNode {
  if (family === "holo") return <HoloSymbol name={name} />;
  if (family === "gem") return <GemSymbol name={name} />;
  return <Image source={ART_3D[name]} style={{ width: "100%", height: "100%" }} contentFit="contain" transition={0} />;
}

export function ThemeFamilyPicker({ value, onChange }: { value: IconFamily; onChange: (f: IconFamily) => void }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const isPremium = usePremiumFlag();
  const options: { id: IconFamily; name: string; sub: string }[] = [
    { id: "holo", name: t.theme_holo, sub: t.theme_holo_sub },
    { id: "3d", name: t.theme_3d, sub: t.theme_3d_sub },
    { id: "gem", name: t.theme_gem, sub: t.theme_gem_sub },
  ];
  return (
    <View style={styles.list} testID="theme-family-picker">
      {options.map((o) => {
        const on = value === o.id;
        const locked = !isPremium && isPremiumFamily(o.id);
        return (
          <Pressable key={o.id} testID={`theme-${o.id}-tile`} onPress={() => (locked ? router.push("/premium") : onChange(o.id))}
            accessibilityRole="radio" accessibilityState={{ selected: on }}
            style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && styles.pressed]}>
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{o.name}</Text>
                  {o.id === "holo" ? (
                    <View style={[styles.basePill, { borderColor: withAlpha(colors.brand, 0.6), backgroundColor: withAlpha(colors.brand, 0.14) }]} testID="theme-holo-base-badge">
                      <Text style={[styles.basePillText, { color: colors.brand }]}>{t.theme_base}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.sub} numberOfLines={1}>{o.sub}</Text>
              </View>
              {on ? (
                <View style={styles.status} testID={`theme-${o.id}-current`}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.cyan} />
                  <Text style={styles.statusText}>{t.theme_current}</Text>
                </View>
              ) : locked ? (
                <View style={[styles.lockPill, { borderColor: withAlpha(colors.warning, 0.6), backgroundColor: withAlpha(colors.warning, 0.12) }]} testID={`theme-${o.id}-locked`}>
                  <Ionicons name="lock-closed" size={11} color={colors.warning} />
                  <Text style={[styles.lockText, { color: colors.warning }]}>Premium</Text>
                </View>
              ) : <View style={styles.radio} />}
            </View>
            <View style={[styles.strip, locked && styles.stripLocked]} testID={`theme-${o.id}-preview`}>
              {REF.map((n) => <View key={n} style={styles.cell}>{refIcon(o.id, n)}</View>)}
            </View>
            {o.id === "holo" ? (
              <View style={styles.note} testID="theme-holo-accent-note">
                <Ionicons name="color-palette-outline" size={14} color={colors.brand} />
                <Text style={styles.noteText}>{t.theme_holo_accent}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  list: { gap: spacing.sm, marginLeft: 32 },
  card: {
    padding: spacing.md, gap: spacing.md, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.glassBorder, backgroundColor: colors.glassBg,
  },
  cardOn: { borderColor: withAlpha(colors.cyan, 0.6), backgroundColor: withAlpha(colors.cyan, 0.08) },
  pressed: { opacity: 0.85 },
  head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  name: { color: colors.onSurface, fontFamily: typography.bodyBold, fontSize: 14 },
  basePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, borderWidth: 1 },
  basePillText: { fontFamily: typography.bodyBold, fontSize: 9, letterSpacing: 0.8 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  noteText: { flex: 1, color: colors.muted, fontFamily: typography.body, fontSize: 11, lineHeight: 15 },
  sub: { color: colors.muted, fontFamily: typography.body, fontSize: 11, marginTop: 1 },
  status: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusText: { color: colors.cyan, fontFamily: typography.bodyMedium, fontSize: 11 },
  lockPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1 },
  lockText: { fontFamily: typography.bodyBold, fontSize: 10 },
  stripLocked: { opacity: 0.75 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: colors.muted },
  strip: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
    borderRadius: radius.md, backgroundColor: colors.artworkSurface,
  },
  cell: { width: 32, height: 32 },
}));
