// PAUSE — "Argomenti attivi" in Home: elemento compatto ed espandibile che
// tiene pulita la Home anche con molti argomenti. Chiuso mostra solo 2-3 icone
// 3D, un "+X" e un chevron; toccandolo si apre in-place una griglia ordinata di
// tutti gli argomenti attivi (stesse tessere in vetro degli Argomenti), con una
// breve comparsa in sequenza. Con molti argomenti il pannello ha un'altezza
// massima e scorre internamente, così la Home non viene mai sforata.
// La gestione completa resta nella tab Argomenti.
import { ReactNode, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Category } from "@/src/api";
import { makeStyles, radius, typography, useTheme, withAlpha, categoryTilePalette as palette } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import * as Haptics from "@/src/haptics";
import { CategoryArtMark } from "./category-artwork";
import { HomeCategoryTile } from "./home-controls";

const GRID_GAP = 12;
const PREVIEW = 3;
const GRID_PAD_TOP = 12;

export function HomeActiveTopics({ categories, activeIds, onToggle, width, padding, overlay }: {
  categories: Category[];
  activeIds: string[];
  onToggle: (id: string) => void;
  /** Larghezza della Home (già limitata a 600). */
  width: number;
  /** Margine laterale della Home. */
  padding: number;
  /** Livello sopra alla griglia (es. avviso "almeno una categoria"). */
  overlay?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const { height: winH } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const progress = useSharedValue(0);

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    const next = !expanded;
    setExpanded(next);
    progress.value = withTiming(next ? 1 : 0, { duration: 280 });
  };

  const avail = width - padding * 2;
  // Tessere ridotte ~35% rispetto alla griglia a 3 colonne: più piccole e ariose
  // nell'espansione in Home; le colonne si adattano (più tessere per riga).
  const tileSize = Math.round(((avail - GRID_GAP * 2) / 3) * 0.65);
  const cols = Math.max(3, Math.floor((avail + GRID_GAP) / (tileSize + GRID_GAP)));
  const tileH = Math.round(tileSize * 1.32);
  const rows = Math.ceil(categories.length / cols);
  const naturalH = GRID_PAD_TOP + rows * tileH + Math.max(0, rows - 1) * GRID_GAP;
  const maxH = Math.round(winH * 0.44);
  const openH = Math.min(naturalH, maxH);
  const scrolls = naturalH > maxH;

  const bodyStyle = useAnimatedStyle(() => ({ height: progress.value * openH, opacity: progress.value }));
  const chevronStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 180}deg` }] }));

  const preview = categories.slice(0, PREVIEW);
  const extra = categories.length - preview.length;
  const countLabel = categories.length === 1 ? t.active_topics_count_one : t.active_topics_count.replace("{n}", String(categories.length));

  return (
    <View style={{ paddingHorizontal: padding }} testID="home-active-topics">
      <Pressable onPress={toggle} testID="home-active-topics-toggle" accessibilityRole="button"
        accessibilityState={{ expanded }} accessibilityLabel={`${t.active_topics}, ${countLabel}`}
        style={({ pressed }) => [styles.bar, pressed && styles.pressed]}>
        <LinearGradient colors={[palette.top, palette.surface]} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View pointerEvents="none" style={styles.barHighlight} />
        <View style={styles.icons}>
          {preview.map((c, i) => (
            <View key={c.id} style={[styles.miniWrap, i > 0 && styles.miniOverlap, { borderColor: withAlpha(palette.accents[c.id] || c.color, 0.5) }]}>
              <CategoryArtMark categoryId={c.id} color={palette.accents[c.id] || c.color} size={26} plain tight testID={`home-active-mini-${c.id}`} />
            </View>
          ))}
          {extra > 0 ? (
            <View style={[styles.plus, styles.miniOverlap]}>
              <Text style={styles.plusText} testID="home-active-plus">+{extra}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.labelWrap}>
          <Text style={styles.label} testID="home-active-topics-title" numberOfLines={1}>{t.active_topics}</Text>
          <Text style={styles.count} numberOfLines={1}>{countLabel}</Text>
        </View>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={colors.muted} />
        </Animated.View>
      </Pressable>

      <Animated.View style={[styles.body, bodyStyle]} pointerEvents={expanded ? "auto" : "none"} testID="home-active-topics-body">
        <View style={{ height: openH }}>
          <ScrollView
            key={expanded ? "open" : "closed"}
            style={styles.scroll}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={scrolls}
            scrollEnabled={scrolls}
            nestedScrollEnabled
          >
            {categories.map((c, i) => (
              <Animated.View key={c.id} entering={FadeInDown.delay(i * 32).duration(220)} style={{ width: tileSize }}>
                <HomeCategoryTile cat={c} size={tileSize} glass active={activeIds.includes(c.id)} onPress={() => onToggle(c.id)} />
              </Animated.View>
            ))}
          </ScrollView>
          {overlay}
        </View>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  bar: {
    flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md, overflow: "hidden",
    borderWidth: 1, borderColor: withAlpha(colors.brand, 0.28), backgroundColor: palette.surface,
    boxShadow: `0px 4px 16px ${withAlpha(colors.brand, 0.12)}` as any,
  },
  barHighlight: { position: "absolute", top: 0, left: 14, right: 14, height: 1, backgroundColor: colors.glassHighlight },
  pressed: { opacity: 0.9 },
  icons: { flexDirection: "row", alignItems: "center" },
  miniWrap: {
    width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: palette.top, borderWidth: 1,
  },
  miniOverlap: { marginLeft: -9 },
  plus: {
    width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: palette.top, borderWidth: 1, borderColor: withAlpha(colors.brand, 0.4),
  },
  plusText: { color: colors.onSurface, fontFamily: typography.bodyBold, fontSize: 11 },
  labelWrap: { flex: 1, minWidth: 0 },
  label: { color: colors.onSurface, fontFamily: typography.displayBold, fontSize: 15 },
  count: { color: colors.muted, fontFamily: typography.bodyMedium, fontSize: 11, lineHeight: 15, marginTop: 1 },
  body: { overflow: "hidden" },
  scroll: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, paddingTop: GRID_PAD_TOP },
}));
