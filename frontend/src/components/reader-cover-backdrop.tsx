// PAUSE — copertina del lettore: un solo livello fisso dietro allo scroll, a
// tutta larghezza dall'alto dello schermo (dietro la barra), che in basso
// sfuma nell'atmosfera del tema: l'atmosfera è presente "dietro" la copertina
// fin dall'inizio. Scorrendo la copertina sale appena (parallasse), si
// scurisce e si dissolve fino a restare una traccia scura, appena
// riconoscibile, dietro ai capitoli — mai una sostituzione brusca di sfondo.
// Entrando nei capitoli la foto si ingrandisce con uno zoom "intelligente":
// verso il soggetto della copertina (`hero_focal`, stimato dal backend), che
// viene portato nella fascia ancora visibile sotto la barra — il buco nero,
// non un angolo di cielo.
// Solo transform e opacità: fluida anche su Android, in entrambe le direzioni.
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { HeroFocal, Story, isLesson } from "@/src/api";
import { makeStyles, useTheme, withAlpha } from "@/src/theme";
import { CoverFrame } from "./reader-intro";
import { StoryHero } from "./story-hero";
import { LessonCover } from "./lesson-cover";

// Quanto resta della copertina dietro ai capitoli (traccia scura).
const TRACE = 0.4;
// Parallasse: la copertina sale più lenta del contenuto e poi si ferma.
const PARALLAX = 0.28;
// Zoom verso il soggetto nei capitoli: almeno un ingrandimento percepibile,
// più forte per i soggetti piccoli, finché il soggetto riempie la fascia visibile.
const ZOOM_MIN = 1.35, ZOOM_MAX = 1.9;
// Dove si posa il soggetto nella fascia visibile (0 = sotto la barra, 1 = fondo della copertina).
const FOCUS_AT = 0.5;
// Fascia di raccordo sotto la copertina: il fondo in cui la foto si è dissolta
// torna gradualmente all'atmosfera (luci comprese), senza una linea visibile.
// Lunga e con molti passaggi, così la copertina sfuma nel resto dello sfondo
// senza mai disegnare un bordo rettangolare percepibile.
export const COVER_SEAM = 280;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Zoom intelligente a capitoli aperti: scala e spostamento (dopo la scala,
 *  attorno al centro della cornice) che portano il soggetto della copertina al
 *  centro della fascia visibile sotto la barra, senza mai scoprire i bordi. */
export function coverZoom(frame: CoverFrame, focal: HeroFocal | null | undefined, bandTop: number): { scale: number; x: number; y: number } {
  const { width: W, height: H } = frame;
  const f = focal ?? { x: 0.5, y: 0.5, r: 0.35, aspect: W / H };
  // Geometria di `contentFit: cover`: l'immagine riempie la cornice, centrata.
  const wide = f.aspect > W / H;
  const dispH = wide ? H : W / f.aspect, dispW = wide ? H * f.aspect : W;
  const fx = (W - dispW) / 2 + f.x * dispW, fy = (H - dispH) / 2 + f.y * dispH;
  // Fascia visibile a capitoli aperti: dalla barra al fondo della copertina salita di parallasse.
  const band = Math.max(1, H * (1 - PARALLAX) - bandTop);
  const scale = clamp(band / Math.max(1, 2 * f.r * dispH), ZOOM_MIN, ZOOM_MAX);
  const targetY = bandTop + band * FOCUS_AT + PARALLAX * H;
  const cx = W / 2, cy = H / 2;
  const maxX = (W * (scale - 1)) / 2;
  return {
    scale,
    x: clamp(cx - (cx + (fx - cx) * scale), -maxX, maxX),
    // Sopra può scoprirsi solo la parte già uscita dallo schermo con la parallasse.
    y: clamp(targetY - (cy + (fy - cy) * scale), (-H * (scale - 1)) / 2, H * (PARALLAX + (scale - 1) / 2)),
  };
}

/** Raccordo sotto la copertina: dal fondo del tema di nuovo all'atmosfera, gradualmente. */
export function CoverSeam({ top }: { top: number }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[
        colors.atmosBase,
        withAlpha(colors.atmosBase, 0.82),
        withAlpha(colors.atmosBase, 0.5),
        withAlpha(colors.atmosBase, 0.22),
        withAlpha(colors.atmosBase, 0),
      ]}
      locations={[0, 0.3, 0.55, 0.78, 1]}
      style={[styles.seam, { top }]}
      pointerEvents="none"
    />
  );
}

/** Pelle "lettura" della copertina: tinta notte + dissolvenza in basso nell'atmosfera del tema. */
export function CoverNightSkin() {
  const { colors } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Tinta notte: porta ogni foto verso la stessa temperatura blu-notte. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.nightTint }]} />
      {/* In alto un velo leggero per la barra; in basso la foto si dissolve nell'atmosfera. */}
      <LinearGradient colors={[withAlpha(colors.atmosBase, 0.45), withAlpha(colors.atmosBase, 0)]} locations={[0, 1]} style={styles.top} />
      <LinearGradient
        colors={[
          withAlpha(colors.atmosBase, 0),
          withAlpha(colors.atmosBase, 0.18),
          withAlpha(colors.atmosBase, 0.5),
          withAlpha(colors.atmosBase, 0.82),
          colors.atmosBase,
        ]}
        locations={[0, 0.35, 0.62, 0.84, 1]}
        style={styles.bottom}
      />
    </View>
  );
}

export function ReaderCoverBackdrop({ story, scrollY, frame, bandTop, instant = false }: {
  story: Story; scrollY: SharedValue<number>; frame: CoverFrame;
  /** Fondo della barra: da qui in giù la copertina resta visibile nei capitoli (fascia dello zoom). */
  bandTop: number;
  /** Arrivo con la transizione dalla card: la foto è già a schermo sopra, niente dissolvenza d'ingresso. */
  instant?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const hasCover = !!story.hero_image_generated || (!isLesson(story) && !!story.hero_image);
  const zoom = coverZoom(frame, story.hero_image_generated ? story.hero_focal : null, bandTop);

  const box = useAnimatedStyle(() => {
    const y = scrollY.value;
    // Tirando verso il basso oltre l'inizio la foto segue un po' il dito e si stira.
    const pull = y < 0 ? -y : 0;
    return {
      opacity: interpolate(y, [frame.height * 0.25, frame.height * 1.1], [1, TRACE], Extrapolation.CLAMP),
      transform: [
        { translateY: -Math.min(Math.max(0, y), frame.height) * PARALLAX + pull * 0.45 },
        { scale: 1 + Math.min(0.1, pull / 700) },
      ],
    };
  });
  // Zoom intelligente: con lo stesso passo della parallasse la foto si
  // ingrandisce verso il soggetto, che si posa nella fascia visibile.
  const focus = useAnimatedStyle(() => {
    const q = interpolate(scrollY.value, [0, frame.height], [0, 1], Extrapolation.CLAMP);
    return { transform: [{ translateX: zoom.x * q }, { translateY: zoom.y * q }, { scale: 1 + (zoom.scale - 1) * q }] };
  });
  // Si scurisce mentre sale: perde importanza, resta atmosfera.
  const dim = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, frame.height * 0.9], [0, 0.5], Extrapolation.CLAMP),
  }));

  return (
    <Animated.View
      style={[styles.box, { top: frame.top, left: frame.left, width: frame.width, height: frame.height + COVER_SEAM }, box]}
      pointerEvents="none"
      testID="chapter-cover-bg"
    >
      <View style={[styles.photo, { height: frame.height, borderRadius: frame.radius }]}>
        {hasCover ? (
          <Animated.View style={[StyleSheet.absoluteFill, focus]} testID="chapter-cover-zoom">
            <StoryHero story={story} style={StyleSheet.absoluteFill} transition={instant ? 0 : 400} />
          </Animated.View>
        ) : (
          <LessonCover color={colors.muted} icon={story.category_icon} iconSize={72} showBadge={false} style={StyleSheet.absoluteFill} />
        )}
        <CoverNightSkin />
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.atmosBase }, dim]} />
      </View>
      <CoverSeam top={frame.height} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, height: "22%" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, height: "72%" },
  seam: { position: "absolute", left: 0, right: 0, height: COVER_SEAM },
});

const useStyles = makeStyles(() => ({
  box: { position: "absolute", overflow: "hidden" },
  photo: { position: "absolute", top: 0, left: 0, right: 0, overflow: "hidden" },
}));
