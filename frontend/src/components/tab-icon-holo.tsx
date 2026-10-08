// PAUSE — icone della bottom bar rifatte da zero come vettori olografici.
// Ogni icona è disegnata con tratto a gradiente iridescente (colori del tema:
// gradient[0] → brandSecondary → gradient[1]) più una superficie "vetro" con
// riflesso bianco in alto: effetto olografico che segue SEMPRE il tema app
// (accento + chiaro/scuro). Stato neutro = tratto muted; attivo = olografico,
// con crossfade e leggero "pop" come il resto della famiglia.
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useTheme, withAlpha } from "@/src/theme";

export type HoloRoute = "discover" | "explore" | "bookmarks" | "profile";

const STROKE = 1.9;
const sp = { strokeWidth: STROKE, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" as const };

// Sagome piene (per la superficie vetro) e tratti (contorno).
function Silhouette({ route, fill }: { route: HoloRoute; fill: string }) {
  const f = { fill, stroke: "none" as const };
  switch (route) {
    case "discover":
      return <Path d="M3.6 11.4 L12 4.4 L20.4 11.4 V20.4 H3.6 Z" {...f} />;
    case "explore":
      return (
        <>
          <Rect x={3.6} y={3.6} width={7.4} height={7.4} rx={2.2} {...f} />
          <Rect x={13} y={3.6} width={7.4} height={7.4} rx={2.2} {...f} />
          <Rect x={3.6} y={13} width={7.4} height={7.4} rx={2.2} {...f} />
          <Rect x={13} y={13} width={7.4} height={7.4} rx={2.2} {...f} />
        </>
      );
    case "bookmarks":
      return <Path d="M6.6 4 H17.4 V20.4 L12 15.4 L6.6 20.4 Z" {...f} />;
    case "profile":
      return (
        <>
          <Circle cx={12} cy={8} r={3.6} {...f} />
          <Path d="M5.4 20.4 C5.4 16 8.3 13.9 12 13.9 C15.7 13.9 18.6 16 18.6 20.4 Z" {...f} />
        </>
      );
  }
}

function Outline({ route, stroke }: { route: HoloRoute; stroke: string }) {
  const s = { stroke, ...sp };
  switch (route) {
    case "discover":
      return (
        <>
          <Path d="M3.6 11.4 L12 4.4 L20.4 11.4" {...s} />
          <Path d="M5.8 9.8 V20.4 H18.2 V9.8" {...s} />
          <Path d="M9.7 20.4 V14.2 H14.3 V20.4" {...s} />
        </>
      );
    case "explore":
      return (
        <>
          <Rect x={3.6} y={3.6} width={7.4} height={7.4} rx={2.2} {...s} />
          <Rect x={13} y={3.6} width={7.4} height={7.4} rx={2.2} {...s} />
          <Rect x={3.6} y={13} width={7.4} height={7.4} rx={2.2} {...s} />
          <Rect x={13} y={13} width={7.4} height={7.4} rx={2.2} {...s} />
        </>
      );
    case "bookmarks":
      return <Path d="M6.6 4 H17.4 V20.4 L12 15.4 L6.6 20.4 Z" {...s} />;
    case "profile":
      return (
        <>
          <Circle cx={12} cy={8} r={3.6} {...s} />
          <Path d="M5.4 20.4 C5.4 16 8.3 13.9 12 13.9 C15.7 13.9 18.6 16 18.6 20.4" {...s} />
        </>
      );
  }
}

export function HoloTabIcon({ route, focused, testID }: { route: HoloRoute; focused: boolean; testID: string }) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const selected = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    selected.value = withTiming(focused ? 1 : 0, { duration: reducedMotion ? 0 : 220, easing: Easing.out(Easing.quad) });
  }, [focused, reducedMotion, selected]);

  const motion = useAnimatedStyle(() => ({ transform: [{ scale: 1 + selected.value * 0.06 }] }));
  const base = useAnimatedStyle(() => ({ opacity: 1 - selected.value }));
  const active = useAnimatedStyle(() => ({ opacity: selected.value }));

  const [g0, g1] = colors.gradient;
  const strokeId = `holo-${route}-s`;
  const fillId = `holo-${route}-f`;

  return (
    <Animated.View pointerEvents="none" testID={testID} style={[styles.icon, motion]}>
      {/* Stato neutro: solo contorno muted. */}
      <Animated.View testID={`${testID}-base`} style={[StyleSheet.absoluteFill, base]}>
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Outline route={route} stroke={withAlpha(colors.muted, 0.95)} />
        </Svg>
      </Animated.View>
      {/* Stato attivo: superficie vetro + contorno a gradiente olografico. */}
      <Animated.View testID={`${testID}-active`} style={[StyleSheet.absoluteFill, active]}>
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Defs>
            <LinearGradient id={strokeId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={g0} />
              <Stop offset="0.5" stopColor={colors.brandSecondary} />
              <Stop offset="1" stopColor={g1} />
            </LinearGradient>
            <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.24} />
              <Stop offset="0.45" stopColor={colors.brand} stopOpacity={0.12} />
              <Stop offset="1" stopColor={g1} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Silhouette route={route} fill={`url(#${fillId})`} />
          <Outline route={route} stroke={`url(#${strokeId})`} />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ icon: { width: 28, height: 28 } });
