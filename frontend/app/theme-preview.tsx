// PAUSE — anteprima di 3 proposte di terzo tema a RENDER 3D (Claymorph · Low-Poly · Gemstone).
// Non modifica il motore dei temi: ogni mockup è un SVG a gradienti con
// highlight e ombra che approssima il materiale 3D del tema. Scelto lo stile,
// rigeneriamo i veri render AI per tutte e 12 le categorie e li agganciamo
// come terzo tema in Profilo → Tema (accanto a Olografico e 3D Realistico).
import { View, Text, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";
import Svg, { Defs, LinearGradient as SvgGradient, RadialGradient, Stop, Path, Circle, Rect, Ellipse, Polygon } from "react-native-svg";

import { makeStyles, useTheme, spacing, radius, typography, withAlpha } from "@/src/theme";

type Style = "clay" | "lowpoly" | "gem";

// ============== Icone 3D "fatte a mano" via SVG, per dare un'anteprima
// realistica del materiale di ciascun tema. Nel tema vero saranno render
// AI (come gli attuali Olografico e 3D Realistico).

function Bulb({ style, size = 72 }: { style: Style; size?: number }) {
  // CLAY: corpo pastello giallo-crema, highlight bianco morbido in alto.
  // LOWPOLY: due facce (light / shadow) con sfaccettatura verticale.
  // GEM: vetro dorato lucido con riflessi caldi.
  const grads = {
    clay:    { fill1: "#FFE28F", fill2: "#F0B457", base: "#8E6A2A", hl: "rgba(255,255,255,0.65)" },
    lowpoly: { fill1: "#F6D06C", fill2: "#AC7F28", base: "#6E4E12", hl: "rgba(255,255,255,0.35)" },
    gem:     { fill1: "#FFD36B", fill2: "#C97A1F", base: "#5A2E07", hl: "rgba(255,246,214,0.9)" },
  }[style];
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <RadialGradient id="bulbClay" cx="40%" cy="38%" r="55%">
          <Stop offset="0" stopColor={grads.fill1} />
          <Stop offset="1" stopColor={grads.fill2} />
        </RadialGradient>
        <SvgGradient id="bulbLow" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={grads.fill1} />
          <Stop offset="0.5" stopColor={grads.fill1} />
          <Stop offset="0.5" stopColor={grads.fill2} />
          <Stop offset="1" stopColor={grads.fill2} />
        </SvgGradient>
        <SvgGradient id="bulbGem" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={grads.fill1} />
          <Stop offset="0.55" stopColor={grads.fill2} />
          <Stop offset="1" stopColor={grads.base} />
        </SvgGradient>
      </Defs>
      {/* Contact-shadow discreto, non alone duro. */}
      <Ellipse cx="36" cy="63" rx="18" ry="2.5" fill="rgba(0,0,0,0.25)" />
      {/* Base/filetto. */}
      <Rect x="27" y="48" width="18" height="4" rx="1.2" fill={grads.base} />
      <Rect x="28" y="52" width="16" height="3" rx="1" fill={grads.base} />
      <Rect x="29.5" y="55" width="13" height="3" rx="1" fill={grads.base} />
      {/* Corpo lampadina. */}
      <Path d="M36 8 C24 8 18 18 20 28 C21.5 36 27 40 27 48 L45 48 C45 40 50.5 36 52 28 C54 18 48 8 36 8 Z"
            fill={style === "clay" ? "url(#bulbClay)" : style === "lowpoly" ? "url(#bulbLow)" : "url(#bulbGem)"} />
      {/* Highlight realistico. */}
      {style === "clay" && (
        <Path d="M28 16 C25 20 24 25 25 30" stroke={grads.hl} strokeWidth="4" strokeLinecap="round" fill="none" />
      )}
      {style === "lowpoly" && (
        <>
          <Polygon points="36,8 20,28 36,28" fill="rgba(255,255,255,0.18)" />
          <Polygon points="36,8 52,28 36,28" fill="rgba(0,0,0,0.12)" />
        </>
      )}
      {style === "gem" && (
        <Path d="M28 12 Q25 18 26 26" stroke={grads.hl} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}
    </Svg>
  );
}

function Book({ style, size = 72 }: { style: Style; size?: number }) {
  const grads = {
    clay:    { c1: "#F3A6A0", c2: "#C56A66", spine: "#8A3A36", pages: "#FFF4EC" },
    lowpoly: { c1: "#E58B82", c2: "#A05048", spine: "#6B2A26", pages: "#F4E0CF" },
    gem:     { c1: "#C77BE5", c2: "#5D2EA6", spine: "#2E0D52", pages: "#F6E7FF" },
  }[style];
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <SvgGradient id={`book-${style}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={grads.c1} />
          <Stop offset="1" stopColor={grads.c2} />
        </SvgGradient>
      </Defs>
      <Ellipse cx="36" cy="60" rx="22" ry="2.5" fill="rgba(0,0,0,0.25)" />
      {/* Pagine. */}
      <Rect x="14" y="20" width="44" height="36" rx="3" fill={grads.pages} />
      <Rect x="14" y="20" width="44" height="36" rx="3" fill="none" stroke="rgba(0,0,0,0.08)" />
      {/* Copertina. */}
      <Path d="M16 16 L58 16 L58 56 C58 56 46 50 36 52 C26 50 14 56 14 56 L14 18 Z" fill={`url(#book-${style})`} />
      {/* Dorso. */}
      <Rect x="34" y="16" width="4" height="36" fill={grads.spine} opacity="0.6" />
      {/* Highlight. */}
      {style === "clay" && <Path d="M20 22 Q24 25 24 32" stroke="rgba(255,255,255,0.55)" strokeWidth="3" fill="none" strokeLinecap="round" />}
      {style === "lowpoly" && <Polygon points="16,16 36,16 20,52" fill="rgba(255,255,255,0.12)" />}
      {style === "gem" && <Path d="M20 22 Q22 30 22 42" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" strokeLinecap="round" />}
    </Svg>
  );
}

function Planet({ style, size = 72 }: { style: Style; size?: number }) {
  const grads = {
    clay:    { c1: "#7FD4D2", c2: "#2E8A95", ring: "#F4C98A", band: "#2A6A72" },
    lowpoly: { c1: "#6FC2BF", c2: "#1F6670", ring: "#D8A762", band: "#154750" },
    gem:     { c1: "#6EDAC9", c2: "#1B5F65", ring: "#F6E27A", band: "#0E3C44" },
  }[style];
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <RadialGradient id={`planet-${style}`} cx="38%" cy="35%" r="65%">
          <Stop offset="0" stopColor={grads.c1} />
          <Stop offset="1" stopColor={grads.c2} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="36" cy="60" rx="22" ry="2.5" fill="rgba(0,0,0,0.25)" />
      {/* Anello dietro. */}
      <Ellipse cx="36" cy="38" rx="30" ry="7" fill="none" stroke={grads.ring} strokeWidth="4" opacity="0.9" />
      {/* Pianeta. */}
      <Circle cx="36" cy="36" r="20" fill={`url(#planet-${style})`} />
      {/* Banda planet. */}
      <Path d="M18 38 Q36 44 54 38" stroke={grads.band} strokeWidth="2.5" fill="none" opacity="0.55" />
      {/* Highlight. */}
      {style === "clay" && <Circle cx="28" cy="28" r="5" fill="rgba(255,255,255,0.45)" />}
      {style === "lowpoly" && <Polygon points="36,16 56,36 36,36" fill="rgba(255,255,255,0.18)" />}
      {style === "gem" && <Path d="M22 24 Q30 20 42 22" stroke="rgba(255,255,255,0.65)" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      {/* Anello davanti. */}
      <Path d="M6 38 Q36 48 66 38" stroke={grads.ring} strokeWidth="4" fill="none" opacity="0.9" />
    </Svg>
  );
}

function Clock({ style, size = 72 }: { style: Style; size?: number }) {
  const grads = {
    clay:    { case1: "#B5D6FF", case2: "#5A86BF", face: "#FFFBF3", hand: "#2A3B5F" },
    lowpoly: { case1: "#9EC0E6", case2: "#466C9F", face: "#F3EFE5", hand: "#1B2A4A" },
    gem:     { case1: "#D7E2FF", case2: "#4762A8", face: "#FFF9F0", hand: "#2A1F55" },
  }[style];
  return (
    <Svg width={size} height={size} viewBox="0 0 72 72">
      <Defs>
        <RadialGradient id={`clock-${style}`} cx="40%" cy="35%" r="60%">
          <Stop offset="0" stopColor={grads.case1} />
          <Stop offset="1" stopColor={grads.case2} />
        </RadialGradient>
      </Defs>
      <Ellipse cx="36" cy="60" rx="22" ry="2.5" fill="rgba(0,0,0,0.25)" />
      {/* Cassa. */}
      <Circle cx="36" cy="36" r="26" fill={`url(#clock-${style})`} />
      <Circle cx="36" cy="36" r="22" fill={grads.face} />
      {/* Tacche. */}
      {[0, 90, 180, 270].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x1 = 36 + Math.cos(rad) * 20, y1 = 36 + Math.sin(rad) * 20;
        const x2 = 36 + Math.cos(rad) * 17, y2 = 36 + Math.sin(rad) * 17;
        return <Path key={deg} d={`M${x1} ${y1} L${x2} ${y2}`} stroke={grads.hand} strokeWidth="2" strokeLinecap="round" />;
      })}
      {/* Lancette. */}
      <Path d="M36 36 L36 22" stroke={grads.hand} strokeWidth="3" strokeLinecap="round" />
      <Path d="M36 36 L48 40" stroke={grads.hand} strokeWidth="2.5" strokeLinecap="round" />
      <Circle cx="36" cy="36" r="2.5" fill={grads.hand} />
      {/* Highlight. */}
      {style === "clay" && <Path d="M22 22 Q18 32 20 42" stroke="rgba(255,255,255,0.5)" strokeWidth="4" fill="none" strokeLinecap="round" />}
      {style === "lowpoly" && <Polygon points="36,10 62,36 36,36" fill="rgba(255,255,255,0.18)" />}
      {style === "gem" && <Path d="M18 24 Q26 18 38 20" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
    </Svg>
  );
}

// ============== Card del mockup

type Candidate = {
  id: Style;
  name: string;
  tagline: string;
  blurb: string;
  bg: string;      // sfondo scheda, per far risaltare il materiale
  accent: string;  // colore pill / dettagli
};

const CANDIDATES: Candidate[] = [
  {
    id: "clay",
    name: "Claymorph 3D",
    tagline: "ARGILLA · CALDO",
    blurb: "Oggetti in plastilina morbida, pastelli caldi e highlight soffusi. Da Pixar: invita al relax, perfetto per leggere senza fretta.",
    bg: "#1D1A2A",
    accent: "#F0B457",
  },
  {
    id: "lowpoly",
    name: "Low-Poly 3D",
    tagline: "GEOMETRICO · PULITO",
    blurb: "Oggetti 3D con sfaccettature a vista e shading a due toni. Estetica da videogioco indie moderno, molto distintiva e leggera.",
    bg: "#102030",
    accent: "#A05048",
  },
  {
    id: "gem",
    name: "Gemstone 3D",
    tagline: "GIOIELLO · PREMIUM",
    blurb: "Vetro dicroico, oro liquido, ametista lucida. Elegante e premium — PAUSE diventa il tuo museo privato del sapere.",
    bg: "#0B1024",
    accent: "#C97A1F",
  },
];

export default function ThemePreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ height: insets.top }} />
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={16} testID="theme-preview-back">
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <View style={{ gap: 6 }}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Prova nuovi temi</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Tre direzioni 3D distinte, come lo sono già Olografico e 3D Realistico. Scelta la tua preferita, rigenero
            tutti i render AI delle 12 categorie e la aggancio come terzo tema.
          </Text>
        </View>

        {CANDIDATES.map((c, i) => (
          <View key={c.id} style={[styles.card, { backgroundColor: c.bg }]} testID={`theme-candidate-${c.id}`}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{c.name}</Text>
                <Text style={[styles.cardTag, { color: c.accent }]}>{c.tagline}</Text>
              </View>
              <View style={[styles.indexPill, { backgroundColor: withAlpha(c.accent, 0.18), borderColor: withAlpha(c.accent, 0.6) }]}>
                <Text style={[styles.indexTxt, { color: c.accent }]}>{String.fromCharCode(65 + i)}</Text>
              </View>
            </View>

            <Text style={styles.cardBlurb}>{c.blurb}</Text>

            {/* Icone-tipo del tema: lampadina, libro, pianeta, orologio. */}
            <View style={styles.iconRow}>
              <View style={[styles.iconTile, { backgroundColor: withAlpha("#FFFFFF", 0.04), borderColor: withAlpha(c.accent, 0.25) }]}>
                <Bulb style={c.id} size={64} />
              </View>
              <View style={[styles.iconTile, { backgroundColor: withAlpha("#FFFFFF", 0.04), borderColor: withAlpha(c.accent, 0.25) }]}>
                <Book style={c.id} size={64} />
              </View>
              <View style={[styles.iconTile, { backgroundColor: withAlpha("#FFFFFF", 0.04), borderColor: withAlpha(c.accent, 0.25) }]}>
                <Planet style={c.id} size={64} />
              </View>
              <View style={[styles.iconTile, { backgroundColor: withAlpha("#FFFFFF", 0.04), borderColor: withAlpha(c.accent, 0.25) }]}>
                <Clock style={c.id} size={64} />
              </View>
            </View>

            {/* Mini badge come apparirebbe nelle story card. */}
            <View style={[styles.badge, { backgroundColor: withAlpha("#FFFFFF", 0.06), borderColor: withAlpha(c.accent, 0.35) }]}>
              <View style={styles.badgeCell}>
                <Book style={c.id} size={26} />
                <Text style={styles.badgeTxt}>Curiosità</Text>
              </View>
              <View style={[styles.badgeDiv, { backgroundColor: withAlpha(c.accent, 0.35) }]} />
              <View style={styles.badgeCell}>
                <Planet style={c.id} size={26} />
                <Text style={styles.badgeTxt}>Spazio</Text>
              </View>
              <View style={[styles.badgeDiv, { backgroundColor: withAlpha(c.accent, 0.35) }]} />
              <View style={styles.badgeCell}>
                <Clock style={c.id} size={26} />
                <Text style={styles.badgeTxt}>3 min</Text>
              </View>
            </View>
          </View>
        ))}

        <Text style={[styles.footer, { color: colors.muted }]}>
          Dimmi quale ti piace (A · Claymorph, B · Low-Poly, C · Gemstone). Nota: queste icone sono un&apos;anteprima in SVG; nel tema vero
          saranno veri render 3D AI come lo sono gli altri due temi — li genero quando la Universal Key è di nuovo carica.
        </Text>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  topBar: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, flexDirection: "row", alignItems: "center" },
  title: { fontFamily: typography.displayHero, fontSize: 28, lineHeight: 32 },
  subtitle: { fontFamily: typography.body, fontSize: 13, lineHeight: 18 },

  card: {
    borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md,
    borderWidth: 1, borderColor: withAlpha(colors.muted, 0.2),
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardName: { color: "#FFFFFF", fontFamily: typography.displayHero, fontSize: 22, lineHeight: 26 },
  cardTag: { fontFamily: typography.bodyMedium, fontSize: 10, letterSpacing: 1.2, marginTop: 2 },
  cardBlurb: { color: "rgba(234,242,255,0.78)", fontFamily: typography.body, fontSize: 13, lineHeight: 19 },

  indexPill: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  indexTxt: { fontFamily: typography.displayHero, fontSize: 18 },

  iconRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  iconTile: { flex: 1, aspectRatio: 1, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  badge: { flexDirection: "row", borderRadius: 14, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 10, alignItems: "center" },
  badgeCell: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, justifyContent: "center" },
  badgeDiv: { width: 1, height: 22 },
  badgeTxt: { color: "#EAF2FF", fontFamily: typography.body, fontSize: 11 },

  footer: { fontFamily: typography.body, fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: spacing.sm },
}));
