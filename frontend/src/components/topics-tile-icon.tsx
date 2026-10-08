// PAUSE — icona del tab "Argomenti" ridisegnata da zero come vettore.
// Richiama la forma dei riquadri categoria (griglia 2x2 di tessere con angoli
// arrotondati) e i colori del brand (gradiente cyan -> viola) con un tocco di
// gloss. Stato neutro (muted) quando non selezionato, gradiente vivido quando
// attivo, con crossfade e leggero "pop" come gli altri 3D della famiglia.
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useTheme, withAlpha } from "@/src/theme";

// Quattro tessere 40x40, margine 6, gap 8 → viewBox 100x100.
const TILES = [
  { x: 6, y: 6 },
  { x: 54, y: 6 },
  { x: 6, y: 54 },
  { x: 54, y: 54 },
] as const;
const SIZE = 40;
const R = 12;

function Grid({ fill, gloss }: { fill: string; gloss: boolean }) {
  return (
    <>
      {TILES.map((t, i) => (
        <Rect key={`t${i}`} x={t.x} y={t.y} width={SIZE} height={SIZE} rx={R} ry={R} fill={fill} />
      ))}
      {gloss
        ? TILES.map((t, i) => (
            <Rect
              key={`g${i}`}
              x={t.x}
              y={t.y}
              width={SIZE}
              height={SIZE * 0.52}
              rx={R}
              ry={R}
              fill="url(#topicsGloss)"
            />
          ))
        : null}
    </>
  );
}

export function TopicsTileIcon({ focused, testID }: { focused: boolean; testID: string }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const selected = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    selected.value = withTiming(focused ? 1 : 0, {
      duration: reducedMotion ? 0 : 220,
      easing: Easing.out(Easing.quad),
    });
  }, [focused, reducedMotion, selected]);

  const motion = useAnimatedStyle(() => ({ transform: [{ scale: 1 + selected.value * 0.06 }] }));
  const base = useAnimatedStyle(() => ({ opacity: 1 - selected.value }));
  const active = useAnimatedStyle(() => ({ opacity: selected.value }));

  const [gStart, gEnd] = colors.gradient;

  return (
    <Animated.View pointerEvents="none" testID={testID} style={[styles.icon, motion]}>
      {/* Stato neutro */}
      <Animated.View testID={`${testID}-base`} style={[StyleSheet.absoluteFill, base]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Grid fill={withAlpha(colors.muted, 0.9)} gloss={false} />
        </Svg>
      </Animated.View>
      {/* Stato attivo: gradiente cyan -> viola attraverso la griglia + gloss */}
      <Animated.View testID={`${testID}-active`} style={[StyleSheet.absoluteFill, active]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="topicsFill" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={gEnd} />
              <Stop offset="1" stopColor={gStart} />
            </LinearGradient>
            <LinearGradient id="topicsGloss" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.38} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Grid fill="url(#topicsFill)" gloss />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ icon: { width: 28, height: 28 } });
