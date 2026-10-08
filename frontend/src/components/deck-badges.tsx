// PAUSE — i tre dati della storia (Tipo · Categoria · Durata) sotto la card
// della Home, nello stesso "vetro" della scheda del lettore (StoryInfoGrid
// inline). Al cambio card i dati si incrociano in dissolvenza: il blocco
// vecchio svanisce mentre il nuovo compare sopra, nello stesso istante
// (nessun vuoto tra i due), rapido e fluido anche scorrendo veloce.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { StoryPreview, categoryArtworkUrl } from "@/src/api";
import { StoryInfoGrid } from "./story-info-grid";
import { CATEGORY_ART_VERSION } from "./category-artwork";

// Geometria condivisa con la transizione verso il lettore (story-morph).
export const DECK_BADGES_GAP = 10;
export const DECK_BADGES_H = 54;
const CROSSFADE_MS = 180;

type Props = {
  story: StoryPreview; width: number;
  /** Card vicine (sinistra/destra): le loro icone categoria si scaricano in anticipo, così la dissolvenza non mostra mai un'icona in ritardo. */
  neighbors?: (StoryPreview | undefined)[];
};

export function DeckBadges({ story, width, neighbors }: Props) {
  // `current` è la storia mostrata in primo piano; `leaving` quella che sta svanendo sotto.
  const [current, setCurrent] = useState(story);
  const [leaving, setLeaving] = useState<StoryPreview | null>(null);
  const progress = useSharedValue(1);
  const leavingId = useRef<string | null>(null);

  useEffect(() => {
    if (current.id === story.id) return;
    // Cambio a metà dissolvenza: la storia in primo piano diventa quella che esce.
    cancelAnimation(progress);
    leavingId.current = current.id;
    setLeaving(current);
    setCurrent(story);
    progress.value = 0;
    progress.value = withTiming(1, { duration: CROSSFADE_MS, easing: Easing.out(Easing.cubic) }, (done) => {
      if (done) runOnJS(setLeaving)(null);
    });
  }, [story, current, progress]);

  // Icone categoria delle card accanto già in cache prima che arrivino al centro.
  const neighborKey = (neighbors ?? []).map((s) => s?.category_id ?? "").join("|");
  useEffect(() => {
    neighborKey.split("|").filter(Boolean).forEach((id) => {
      Image.prefetch(categoryArtworkUrl(id, CATEGORY_ART_VERSION, true, true), "memory-disk").catch(() => {});
    });
  }, [neighborKey]);

  const inStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 4 }],
  }));
  const outStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [{ translateY: -(progress.value) * 4 }],
  }));

  return (
    <View style={[styles.slot, { width }]} testID="deck-badges" pointerEvents="none">
      {leaving ? (
        <Animated.View style={[styles.grid, styles.leaving, outStyle]} testID={`deck-badges-leaving-${leaving.id}`}>
          <StoryInfoGrid story={leaving} minutes={leaving.reading_time_min} inline testID="home-story-meta-leaving" />
        </Animated.View>
      ) : null}
      <Animated.View style={[styles.grid, inStyle]} testID={`deck-badges-${current.id}`}>
        <StoryInfoGrid story={current} minutes={current.reading_time_min} inline testID="home-story-meta" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { height: DECK_BADGES_H, marginTop: DECK_BADGES_GAP, alignSelf: "center", justifyContent: "center" },
  grid: { alignSelf: "stretch" },
  leaving: { position: "absolute", left: 0, right: 0 },
});
