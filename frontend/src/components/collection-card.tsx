// PAUSE — carta della Collezione. Sbloccata: copertina, titolo e bordo nel
// colore della categoria. Bloccata: superficie scura atmosferica, bordo
// attenuato e un piccolo segno di scoperta (nessuna rarità/punti).
import { View, Text, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";

import { StoryPreview } from "@/src/api";
import { makeStyles, useTheme, radius, typography, withAlpha } from "@/src/theme";
import { StoryHero } from "@/src/components/story-hero";
import { CategoryArtMark } from "@/src/components/category-artwork";

export const CARD_W = 108, CARD_H = 148;

export function CollectionCard({ story, onPress, testID, width = CARD_W, height = CARD_H }: {
  story: StoryPreview; onPress?: () => void; testID?: string; width?: number; height?: number;
}) {
  const styles = useStyles();
  const color = story.category_color;
  const cardStyle = [styles.card, { width, height, borderColor: withAlpha(color, 0.7), boxShadow: `0px 6px 18px ${withAlpha(color, 0.22)}` as any }];
  // Miniature (es. fine lettura): solo copertina intera, senza titolo sopra che la copra.
  const compact = width < 90;
  const content = (
    <>
      <StoryHero story={story} style={StyleSheet.absoluteFill} size="thumb" iconSize={28} transition={0} />
      {compact ? null : <LinearGradient pointerEvents="none" colors={["transparent", "rgba(4,10,20,0.88)"]} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />}
      <View style={[styles.dot, { backgroundColor: color }, compact && styles.dotCompact]} />
      {compact ? null : <Text style={styles.title} numberOfLines={2}>{story.title}</Text>}
    </>
  );
  // Anteprima dentro un altro pulsante (fine lettura): semplice View.
  if (!onPress) return <View style={cardStyle} testID={testID}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={story.title}
      style={({ pressed }) => [...cardStyle, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
    >
      {content}
    </Pressable>
  );
}

// Carta non ancora scoperta: la sagoma dell'icona 3D della propria categoria,
// piccola e attenuata, con un piccolo lucchetto.
export function LockedCard({ color, categoryId, testID, width = CARD_W, height = CARD_H }: { color: string; categoryId: string; testID?: string; width?: number; height?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const art = Math.round(width * 0.34);
  return (
    <View style={[styles.card, styles.locked, { width, height, borderColor: withAlpha(color, 0.22) }]} testID={testID}>
      <LinearGradient pointerEvents="none" colors={[withAlpha(color, 0.14), withAlpha(colors.surfaceDeep, 0.0)]} style={StyleSheet.absoluteFill} />
      <View style={styles.artDim}>
        <CategoryArtMark categoryId={categoryId} color={color} size={art} plain tight testID={`${testID}-art`} />
      </View>
      <View style={[styles.lockBadge, { backgroundColor: withAlpha(colors.surfaceDeep, 0.85), borderColor: withAlpha(color, 0.5) }]}>
        <Ionicons name="lock-closed" size={11} color={withAlpha(color, 0.9)} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    borderRadius: radius.md, borderWidth: 1, overflow: "hidden", justifyContent: "flex-end",
    padding: 8, backgroundColor: colors.surfaceTertiary,
  },
  locked: { alignItems: "center", justifyContent: "center", backgroundColor: withAlpha(colors.surfaceDeep, 0.7) },
  artDim: { opacity: 0.4 },
  lockBadge: { position: "absolute", bottom: 10, alignSelf: "center", width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 8, left: 8, width: 7, height: 7, borderRadius: 4 },
  dotCompact: { top: 6, left: 6 },
  title: { color: "#FFFFFF", fontFamily: typography.bodyBold, fontSize: 11, lineHeight: 14, textShadowColor: "rgba(0,0,0,0.7)", textShadowRadius: 4 },
}));
