// PAUSE — tema icone "Gemstone 3D": ogni icona è un gioiello vettoriale
// (gemme sfaccettate con rifrazioni, bordi in oro liquido, scintille).
// Stato spento = cristallo fumé con bordi argento; acceso = gemme colorate.
// I colori delle gemme sono materiali fissi (identici in chiaro e scuro).
import { useEffect, useId } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Image } from "expo-image";
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Polygon, Stop } from "react-native-svg";

export type GemName = "bulb" | "books" | "book" | "heart" | "bookmark" | "share" | "clock" | "headphones" | "home" | "topics" | "profile";
export type GemRoute = "discover" | "explore" | "bookmarks" | "profile";

type Tone = [string, string, string];
const GEM: Record<string, Tone> = {
  ruby: ["#FF8FA3", "#E0103A", "#6A0018"],
  sapphire: ["#9CC2FF", "#2350D8", "#0B1A66"],
  amethyst: ["#E2B6FF", "#8B3FD9", "#3A0F6E"],
  aqua: ["#C9FBFF", "#26C6DA", "#0B5868"],
  emerald: ["#A8F5C8", "#10A860", "#03462A"],
  citrine: ["#FFF0A8", "#F5A623", "#8A4A00"],
  topaz: ["#FFF3D6", "#E8BE7A", "#8C6532"],
  diamond: ["#FFFFFF", "#D6ECFF", "#7FA0CC"],
  pearl: ["#FFFFFF", "#F4EFF9", "#CFC5DE"],
  gold: ["#FFF3BF", "#E2A93B", "#7E5110"],
  smoke: ["#F1EFF7", "#A9A3BE", "#575170"],
};
const GOLD_RIM: Tone = ["#FFF6CC", "#E0A83A", "#8A5A12"];
const SILVER_RIM: Tone = ["#FFFFFF", "#C9C5D6", "#77728C"];

const rr = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;
const circ = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

type Part = { d: string; tone: keyof typeof GEM; box: [number, number, number, number]; facets?: boolean };

const SHAPES: Record<GemName, { parts: Part[]; strokes?: { d: string; w: number }[]; sparkle?: [number, number][] }> = {
  heart: {
    parts: [{ d: "M32 55 C18 45 7 36 7 23 C7 14.5 13.5 8.5 21.5 8.5 C26 8.5 29.8 11 32 14.5 C34.2 11 38 8.5 42.5 8.5 C50.5 8.5 57 14.5 57 23 C57 36 46 45 32 55 Z", tone: "ruby", box: [7, 8, 57, 55] }],
    sparkle: [[18, 17], [46, 22]],
  },
  bookmark: {
    parts: [{ d: "M19 7 H45 Q48 7 48 10 V57 L32 45.5 L16 57 V10 Q16 7 19 7 Z", tone: "aqua", box: [16, 7, 48, 57] }],
    sparkle: [[23, 15]],
  },
  share: {
    parts: [
      { d: "M11 30 H22 V36 H17.5 V50.5 H46.5 V36 H42 V30 H53 V57 H11 Z", tone: "aqua", box: [11, 30, 53, 57] },
      { d: "M32 5 L47 20 H37.5 V41 H26.5 V20 H17 Z", tone: "aqua", box: [17, 5, 47, 41] },
    ],
    sparkle: [[27, 15]],
  },
  home: {
    parts: [
      { d: "M14 31 H50 V57 H14 Z", tone: "aqua", box: [14, 31, 50, 57] },
      { d: "M27 57 V45 Q32 39 37 45 V57 Z", tone: "amethyst", box: [27, 39, 37, 57] },
      { d: "M6 32 L32 9 L58 32 L52.5 37 L32 19 L11.5 37 Z", tone: "amethyst", box: [6, 9, 58, 37] },
    ],
    sparkle: [[20, 38]],
  },
  topics: {
    parts: [
      { d: rr(7, 7, 23, 23, 6), tone: "aqua", box: [7, 7, 30, 30] },
      { d: rr(34, 7, 23, 23, 6), tone: "amethyst", box: [34, 7, 57, 30] },
      { d: rr(7, 34, 23, 23, 6), tone: "aqua", box: [7, 34, 30, 57] },
      { d: rr(34, 34, 23, 23, 6), tone: "aqua", box: [34, 34, 57, 57] },
    ],
    sparkle: [[13, 12], [40, 12]],
  },
  profile: {
    parts: [
      { d: circ(32, 20, 12), tone: "aqua", box: [20, 8, 44, 32] },
      { d: "M9 57 C9 44.5 19 37 32 37 C45 37 55 44.5 55 57 Z", tone: "aqua", box: [9, 37, 55, 57] },
    ],
    sparkle: [[26, 14]],
  },
  bulb: {
    parts: [
      { d: "M32 5 C20 5 12.5 14 12.5 24.5 C12.5 32.5 18.5 36.5 21.5 42 H42.5 C45.5 36.5 51.5 32.5 51.5 24.5 C51.5 14 44 5 32 5 Z", tone: "diamond", box: [12, 5, 52, 42] },
      { d: rr(21, 43, 22, 5, 2), tone: "gold", box: [21, 43, 43, 48], facets: false },
      { d: rr(22.5, 49, 19, 4.5, 2), tone: "gold", box: [22, 49, 42, 54], facets: false },
      { d: "M27 55 H37 L34.5 59 H29.5 Z", tone: "gold", box: [27, 55, 37, 59], facets: false },
    ],
    strokes: [{ d: "M26.5 41 V32 C26.5 27 37.5 27 37.5 32 V41 M29 30 L32 25 L35 30", w: 2.2 }],
    sparkle: [[21, 16]],
  },
  books: {
    parts: [
      { d: rr(9, 41, 46, 14, 3.5), tone: "sapphire", box: [9, 41, 55, 55] },
      { d: rr(13, 26.5, 42, 13.5, 3.5), tone: "emerald", box: [13, 26, 55, 40] },
      { d: rr(8, 12, 44, 13.5, 3.5), tone: "amethyst", box: [8, 12, 52, 26] },
    ],
    strokes: [{ d: "M47 45 V51 M50 30.5 V36 M46 16 V21.5", w: 1.6 }],
    sparkle: [[14, 16]],
  },
  book: {
    parts: [
      { d: "M5 17 V54 C16 51 26 52 32 57.5 C38 52 48 51 59 54 V17 Z", tone: "emerald", box: [5, 17, 59, 58] },
      { d: "M32 17 C24 11 15 11 8.5 13 V50 C15 48.5 25 48.5 32 54 Z", tone: "topaz", box: [8, 11, 32, 54] },
      { d: "M32 17 C40 11 49 11 55.5 13 V50 C49 48.5 39 48.5 32 54 Z", tone: "topaz", box: [32, 11, 56, 54] },
    ],
    sparkle: [[15, 19]],
  },
  clock: {
    parts: [
      { d: rr(28, 3, 8, 6, 2), tone: "gold", box: [28, 3, 36, 9], facets: false },
      { d: circ(32, 34, 25), tone: "amethyst", box: [7, 9, 57, 59] },
      { d: circ(32, 34, 18.5), tone: "pearl", box: [13, 15, 51, 53], facets: false },
    ],
    strokes: [{ d: "M32 34 V21.5 M32 34 L42 39 M32 17.5 V20 M32 48 V50.5 M15.5 34 H18 M46 34 H48.5", w: 2.6 }],
    sparkle: [[16, 22]],
  },
  headphones: {
    parts: [
      { d: "M9 38 C9 19.5 19.5 8 32 8 C44.5 8 55 19.5 55 38 H49 C49 23.5 41.5 14.5 32 14.5 C22.5 14.5 15 23.5 15 38 Z", tone: "amethyst", box: [9, 8, 55, 38] },
      { d: rr(6.5, 33, 15, 24, 6.5), tone: "ruby", box: [6, 33, 22, 57] },
      { d: rr(42.5, 33, 15, 24, 6.5), tone: "ruby", box: [42, 33, 58, 57] },
    ],
    sparkle: [[11, 38], [47, 38]],
  },
};

// Faccette: triangoli dal centro della pietra verso il perimetro, alternando luce e ombra.
function facetPolys([x0, y0, x1, y1]: [number, number, number, number]) {
  const cx = x0 + (x1 - x0) * 0.42, cy = y0 + (y1 - y0) * 0.4;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const ring: [number, number][] = [[x0, y0], [mx, y0 - 1], [x1, y0], [x1 + 1, my], [x1, y1], [mx, y1 + 1], [x0, y1], [x0 - 1, my]];
  const fills = ["rgba(255,255,255,0.34)", "rgba(255,255,255,0.12)", "rgba(0,0,0,0.10)", "rgba(0,0,0,0.26)", "rgba(0,0,0,0.18)", "rgba(255,255,255,0.06)", "rgba(255,255,255,0.20)", "rgba(255,255,255,0.40)"];
  return ring.map((p, i) => {
    const q = ring[(i + 1) % ring.length];
    return { points: `${cx},${cy} ${p[0]},${p[1]} ${q[0]},${q[1]}`, fill: fills[i] };
  }).concat([{ // tavola centrale (faccia piana della gemma)
    points: `${cx - (x1 - x0) * 0.14},${cy - (y1 - y0) * 0.1} ${cx + (x1 - x0) * 0.1},${cy - (y1 - y0) * 0.14} ${cx + (x1 - x0) * 0.16},${cy + (y1 - y0) * 0.08} ${cx - (x1 - x0) * 0.06},${cy + (y1 - y0) * 0.16}`,
    fill: "rgba(255,255,255,0.22)",
  }]);
}

function Sparkle({ x, y, s = 3.6 }: { x: number; y: number; s?: number }) {
  return <Path d={`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`} fill="#FFFFFF" opacity={0.95} />;
}

// Render AI "Gemstone 3D" (stessi soggetti della famiglia 3D). Il disegno SVG
// più sotto resta come ripiego per qualunque icona senza render.
const ART: Partial<Record<GemName, { active: number; base: number }>> = {
  bulb: { active: require("../../assets/images/gem/kind-lesson.png"), base: require("../../assets/images/gem/kind-lesson.png") },
  books: { active: require("../../assets/images/gem/kind-bulb.png"), base: require("../../assets/images/gem/kind-bulb.png") },
  book: { active: require("../../assets/images/gem/kind-book.png"), base: require("../../assets/images/gem/kind-book.png") },
  clock: { active: require("../../assets/images/gem/kind-clock.png"), base: require("../../assets/images/gem/kind-clock.png") },
  headphones: { active: require("../../assets/images/gem/kind-headphones.png"), base: require("../../assets/images/gem/kind-headphones.png") },
  heart: { active: require("../../assets/images/gem/act-heart-active.png"), base: require("../../assets/images/gem/act-heart-base.png") },
  bookmark: { active: require("../../assets/images/gem/act-bookmark-active.png"), base: require("../../assets/images/gem/act-bookmark-base.png") },
  share: { active: require("../../assets/images/gem/act-share.png"), base: require("../../assets/images/gem/act-share.png") },
  home: { active: require("../../assets/images/gem/nav-home-active.png"), base: require("../../assets/images/gem/nav-home-base.png") },
  topics: { active: require("../../assets/images/gem/nav-topics-active.png"), base: require("../../assets/images/gem/nav-topics-base.png") },
  profile: { active: require("../../assets/images/gem/nav-profile-active.png"), base: require("../../assets/images/gem/nav-profile-base.png") },
};

export function GemSymbol({ name, active = true }: { name: GemName; active?: boolean }) {
  const art = ART[name];
  if (art) return <Image source={active ? art.active : art.base} style={styles.fill} contentFit="contain" transition={0} />;
  return <GemVector name={name} active={active} />;
}

function GemVector({ name, active = true }: { name: GemName; active?: boolean }) {
  const uid = useId().replace(/:/g, "");
  const shape = SHAPES[name];
  const rim = active ? GOLD_RIM : SILVER_RIM;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`${uid}-rim`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={rim[0]} />
          <Stop offset="0.5" stopColor={rim[1]} />
          <Stop offset="1" stopColor={rim[2]} />
        </LinearGradient>
        {shape.parts.map((p, i) => {
          const tone = active ? GEM[p.tone] : p.tone === "gold" ? SILVER_RIM : GEM.smoke;
          return (
            <LinearGradient key={`g${i}`} id={`${uid}-g${i}`} x1="0.15" y1="0" x2="0.85" y2="1">
              <Stop offset="0" stopColor={tone[0]} />
              <Stop offset="0.5" stopColor={tone[1]} />
              <Stop offset="1" stopColor={tone[2]} />
            </LinearGradient>
          );
        })}
        {shape.parts.map((p, i) => (
          <ClipPath key={`c${i}`} id={`${uid}-c${i}`}><Path d={p.d} /></ClipPath>
        ))}
      </Defs>
      {shape.parts.map((p, i) => (
        <G key={i}>
          <Path d={p.d} fill={`url(#${uid}-g${i})`} />
          {p.facets === false ? null : (
            <G clipPath={`url(#${uid}-c${i})`}>
              {facetPolys(p.box).map((f, k) => <Polygon key={k} points={f.points} fill={f.fill} />)}
            </G>
          )}
          <Path d={p.d} fill="none" stroke={`url(#${uid}-rim)`} strokeWidth={1.7} strokeLinejoin="round" />
        </G>
      ))}
      {shape.strokes?.map((s, i) => (
        <Path key={`s${i}`} d={s.d} fill="none" stroke={active ? (name === "bulb" ? GEM.citrine[1] : GOLD_RIM[1]) : SILVER_RIM[2]} strokeWidth={s.w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {active ? shape.sparkle?.map(([x, y], i) => <Sparkle key={`k${i}`} x={x} y={y} s={i === 0 ? 3.8 : 2.6} />) : null}
    </Svg>
  );
}

const ROUTE_ICON: Record<GemRoute, GemName> = { discover: "home", explore: "topics", bookmarks: "bookmark", profile: "profile" };

export function GemTabIcon({ route, focused, testID }: { route: GemRoute; focused: boolean; testID: string }) {
  const reducedMotion = useReducedMotion();
  const selected = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    selected.value = withTiming(focused ? 1 : 0, { duration: reducedMotion ? 0 : 220, easing: Easing.out(Easing.quad) });
  }, [focused, reducedMotion, selected]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: 1 + selected.value * 0.06 }] }));
  const base = useAnimatedStyle(() => ({ opacity: 1 - selected.value }));
  const active = useAnimatedStyle(() => ({ opacity: selected.value }));
  const name = ROUTE_ICON[route];
  return (
    <Animated.View testID={testID} style={[styles.icon, { pointerEvents: "none" }, motion]}>
      <Animated.View testID={`${testID}-base`} style={[StyleSheet.absoluteFill, base]}><GemSymbol name={name} active={false} /></Animated.View>
      <Animated.View testID={`${testID}-active`} style={[StyleSheet.absoluteFill, active]}><GemSymbol name={name} /></Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({ icon: { width: 28, height: 28 }, fill: { width: "100%", height: "100%" } });
