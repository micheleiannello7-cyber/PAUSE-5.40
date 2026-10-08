// PAUSE — Shareable story card, captured as PNG and shared (Instagram Stories
// 9:16 or feed Post 4:5). The card is a brand asset: it always uses the dark
// palette so it looks identical whatever theme the sender has picked.
import { View, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@react-native-vector-icons/ionicons";

import { Story, heroUrl, isLesson } from "@/src/api";
import { useTheme, typography, radius, spacing, withAlpha } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { PauseMark } from "@/src/components/pause-logo";
import { LessonCover } from "@/src/components/lesson-cover";

export type ShareFormat = "story" | "post";
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT: Record<ShareFormat, number> = { story: 640, post: 450 };
const CARD_BG = "#05070C";
const CARD_TEXT = "#F4F5F8";
const CARD_TEXT_SOFT = "rgba(244,245,248,0.78)";

export function StoryShareCard({ story, format = "story" }: { story: Story; format?: ShareFormat }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const accent = story.category_color;
  const tall = format === "story";
  const lesson = isLesson(story);
  return (
    <View style={[styles.card, { height: SHARE_CARD_HEIGHT[format] }]} testID={`story-share-card-${format}`}>
      <View style={[styles.hero, { height: tall ? 380 : 230 }]}>
        {lesson && !story.hero_image_generated ? (
          <LessonCover color={accent} icon={story.category_icon} iconSize={64} showBadge={false} style={StyleSheet.absoluteFill} />
        ) : (
          <Image source={{ uri: heroUrl(story) }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
        )}
        <LinearGradient colors={["rgba(5,7,12,0.55)", "rgba(5,7,12,0)", "rgba(5,7,12,0.2)", CARD_BG]} locations={[0, 0.25, 0.6, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <PauseMark size={22} />
            <Text style={styles.wordmark}>PΛUSE</Text>
          </View>
          <View style={styles.timePill}>
            <Ionicons name="time-outline" size={11} color={CARD_TEXT} />
            <Text style={styles.timeText}>{story.reading_time_min} min</Text>
          </View>
        </View>
        <View style={[styles.chip, { backgroundColor: accent }]}>
          <Ionicons name={story.category_icon as any} size={11} color={CARD_BG} />
          <Text style={styles.chipText}>{story.category_name.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>{lesson ? t.share_eyebrow_lesson : t.share_eyebrow_story}</Text>
        <Text style={[styles.title, !tall && styles.titleSmall]} numberOfLines={tall ? 4 : 3}>{story.title}</Text>
        <View style={[styles.rule, { backgroundColor: accent }]} />
        <Text style={styles.hook} numberOfLines={tall ? 4 : 2}>{story.hook}</Text>
      </View>

      <View style={styles.footer}>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaPill}>
          <Text style={styles.ctaText}>{t.share_card_cta}</Text>
          <Ionicons name="arrow-forward" size={12} color={CARD_TEXT} />
        </LinearGradient>
        <Text style={styles.tagline}>{t.tagline}</Text>
      </View>
      <View pointerEvents="none" style={[styles.border, { borderColor: withAlpha(accent, 0.35) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_WIDTH, backgroundColor: CARD_BG, borderRadius: radius.lg, overflow: "hidden" },
  border: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 1, borderRadius: radius.lg },
  hero: { justifyContent: "space-between", padding: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  wordmark: { color: CARD_TEXT, fontFamily: typography.displayBold, fontSize: 14, letterSpacing: 4 },
  timePill: {
    flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, backgroundColor: "rgba(5,7,12,0.55)", borderWidth: 1, borderColor: "rgba(244,245,248,0.2)",
  },
  timeText: { color: CARD_TEXT, fontFamily: typography.bodyBold, fontSize: 10 },
  chip: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  chipText: { color: CARD_BG, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.4 },
  body: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.sm },
  eyebrow: { color: CARD_TEXT_SOFT, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 2 },
  title: { color: CARD_TEXT, fontFamily: typography.displayBold, fontSize: 26, lineHeight: 32 },
  titleSmall: { fontSize: 21, lineHeight: 26 },
  rule: { width: 40, height: 3, borderRadius: 2 },
  hook: { color: CARD_TEXT_SOFT, fontFamily: typography.body, fontSize: 14, lineHeight: 21 },
  footer: { alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.sm },
  ctaPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
  ctaText: { color: CARD_TEXT, fontFamily: typography.bodyBold, fontSize: 12 },
  tagline: { color: CARD_TEXT_SOFT, fontFamily: typography.body, fontSize: 9, letterSpacing: 1.6 },
});
