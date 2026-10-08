// PAUSE — copertina del tema icone "Ologramma" (Profilo → Temi).
// Scena vettoriale: proiettore olografico con cono di luce, glifo olografico
// (lampadina, la stessa della famiglia) sospeso, linee di scansione, griglia
// prospettica e particelle. Colori dal tema (accento) → coerente con le icone.
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/src/theme";

const BULB = "M12 3.4 C8.4 3.4 5.7 6.1 5.7 9.4 C5.7 11.6 6.9 13 8.1 14.2 C8.8 14.9 9.3 15.6 9.5 16.6 H14.5 C14.7 15.6 15.2 14.9 15.9 14.2 C17.1 13 18.3 11.6 18.3 9.4 C18.3 6.1 15.6 3.4 12 3.4 Z";

export function HoloThemePreview({ size = 64, testID }: { size?: number; testID?: string }) {
  const { colors } = useTheme();
  const [g0, g1] = colors.gradient;
  const mid = colors.brandSecondary;
  const reduce = useReducedMotion();
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduce) return;
    float.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduce, float]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * float.value }],
    opacity: 0.88 + 0.12 * float.value,
  }));

  return (
    <View testID={testID} style={{ width: size, height: size }} pointerEvents="none">
      {/* Fondo: spazio profondo, griglia, cono di luce, proiettore. */}
      <Svg width="100%" height="100%" viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="hp-bg" cx="32" cy="30" r="40" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={g1} stopOpacity={0.22} />
            <Stop offset="0.55" stopColor={mid} stopOpacity={0.08} />
            <Stop offset="1" stopColor="#040A14" stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="hp-cone" x1="32" y1="52" x2="32" y2="10" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={g1} stopOpacity={0.4} />
            <Stop offset="0.55" stopColor={mid} stopOpacity={0.1} />
            <Stop offset="1" stopColor={g0} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="hp-grid" x1="0" y1="44" x2="0" y2="64" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={g1} stopOpacity={0} />
            <Stop offset="1" stopColor={g1} stopOpacity={0.45} />
          </LinearGradient>
          <LinearGradient id="hp-base" x1="20" y1="0" x2="44" y2="0" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={g0} />
            <Stop offset="0.5" stopColor={mid} />
            <Stop offset="1" stopColor={g1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="64" height="64" fill="#040A14" />
        <Rect x="0" y="0" width="64" height="64" fill="url(#hp-bg)" />
        {/* Griglia prospettica sul pavimento */}
        <G stroke="url(#hp-grid)" strokeWidth={0.5}>
          {[46, 50, 55, 61].map((y) => <Line key={`h${y}`} x1="0" y1={y} x2="64" y2={y} />)}
          {[-24, -12, 0, 12, 24].map((d) => <Line key={`v${d}`} x1={32 + d * 0.35} y1="44" x2={32 + d * 1.6} y2="64" />)}
        </G>
        {/* Cono di luce dal proiettore */}
        <Path d="M24 51 L12 12 H52 L40 51 Z" fill="url(#hp-cone)" />
        <Path d="M28 51 L22 18 H42 L36 51 Z" fill="url(#hp-cone)" opacity={0.7} />
        {/* Proiettore */}
        <Ellipse cx="32" cy="52.6" rx="13" ry="3.4" fill={g1} opacity={0.12} />
        <Ellipse cx="32" cy="52" rx="11" ry="2.8" fill="#0B1424" stroke="url(#hp-base)" strokeWidth={0.8} />
        <Ellipse cx="32" cy="51.5" rx="6" ry="1.1" fill={g1} opacity={0.7} />
        <Ellipse cx="32" cy="51.5" rx="2.6" ry="0.5" fill="#FFFFFF" opacity={0.9} />
        {/* Particelle */}
        {[[14, 16, 0.7], [50, 20, 0.9], [46, 9, 0.5], [18, 36, 0.6], [53, 38, 0.5], [10, 26, 0.4]].map(([x, y, r], i) => (
          <Circle key={i} cx={x} cy={y} r={r} fill="#FFFFFF" opacity={0.75} />
        ))}
      </Svg>

      {/* Glifo olografico sospeso (fluttua dolcemente). */}
      <Animated.View style={[styles.glyph, { left: size * 0.22, top: size * 0.1, width: size * 0.56, height: size * 0.56 }, floatStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 24 24">
          <Defs>
            <LinearGradient id="hp-s" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={g0} />
              <Stop offset="0.5" stopColor={mid} />
              <Stop offset="1" stopColor={g1} />
            </LinearGradient>
            <LinearGradient id="hp-f" x1="0" y1="3" x2="0" y2="17" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.22} />
              <Stop offset="0.45" stopColor={g1} stopOpacity={0.12} />
              <Stop offset="1" stopColor={mid} stopOpacity={0.04} />
            </LinearGradient>
          </Defs>
          {/* alone morbido */}
          <Path d={BULB} fill="none" stroke={g1} strokeOpacity={0.18} strokeWidth={3.2} strokeLinejoin="round" />
          {/* sdoppiamento cromatico (effetto proiezione) */}
          <G transform="translate(-0.45 0)"><Path d={BULB} fill="none" stroke={g0} strokeOpacity={0.55} strokeWidth={0.7} strokeLinejoin="round" /></G>
          <G transform="translate(0.45 0)"><Path d={BULB} fill="none" stroke={g1} strokeOpacity={0.55} strokeWidth={0.7} strokeLinejoin="round" /></G>
          <Path d={BULB} fill="url(#hp-f)" stroke="url(#hp-s)" strokeWidth={1.2} strokeLinejoin="round" />
          {/* nucleo luminoso + filamento */}
          <Circle cx="12" cy="10.4" r="2.6" fill={g1} opacity={0.22} />
          <Path d="M10.5 13.4 V11.6 C10.5 10.2 13.5 10.2 13.5 11.6 V13.4" fill="none" stroke="#FFFFFF" strokeOpacity={0.85} strokeWidth={0.7} strokeLinecap="round" />
          <Circle cx="12" cy="10.6" r="0.9" fill="#FFFFFF" opacity={0.9} />
          <Path d="M9.8 18.3 H14.2 M10.7 20.4 H13.3" stroke="url(#hp-s)" strokeWidth={1.2} strokeLinecap="round" />
          {/* riflesso vetro */}
          <Path d="M8.3 7.4 C8.9 6.1 10 5.3 11.3 5.05" fill="none" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={0.7} strokeLinecap="round" />
          {/* linee di scansione */}
          {[5, 6.5, 8, 9.5, 11, 12.5, 14, 15.5].map((y) => (
            <Line key={y} x1="5.5" y1={y} x2="18.5" y2={y} stroke={g1} strokeOpacity={0.16} strokeWidth={0.35} />
          ))}
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: { position: "absolute" },
});
