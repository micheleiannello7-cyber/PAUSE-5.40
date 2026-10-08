// PAUSE — sfondo della schermata finale della lettura: ambiente acquatico
// notturno (superficie dell'acqua in basso, luce morbida e diffusa
// sull'orizzonte), scuro e cinematografico, elegante e non invasivo. Livello
// fisso dietro allo scroll, che compare gradualmente solo quando si arriva
// all'ultima pagina ("Da ricordare"). I veli e il bagliore prendono la tonalità
// dal tema corrente (atmosBase / atmosTint / atmosGlow): il blu è solo un
// esempio, con un altro tema lo sfondo cambia hue.
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";

import { useTheme, withAlpha } from "@/src/theme";

const ARTWORK = require("../../assets/images/reader-ending-ocean.jpg");

export function ReaderEndingBackdrop({ scrollY, pageH, endTop }: {
  scrollY: SharedValue<number>; pageH: SharedValue<number>;
  /** Posizione (nello scroll) a cui la schermata finale è tutta in vista. */
  endTop: SharedValue<number>;
}) {
  const { colors } = useTheme();
  const base = colors.atmosBase;
  const fade = useAnimatedStyle(() => {
    const end = endTop.value;
    if (end <= 0) return { opacity: 0 };
    return { opacity: interpolate(scrollY.value, [end - pageH.value * 0.55, end], [0, 1], Extrapolation.CLAMP) };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]} testID="reader-ending-backdrop">
      <Image source={ARTWORK} contentFit="cover" contentPosition="center" transition={0} cachePolicy="memory-disk" accessible={false} style={StyleSheet.absoluteFill} />
      {/* Veli scuri verticali (tonalità del tema): in alto l'immagine si dissolve
          del tutto nell'atmosfera dei capitoli (nessun bordo rettangolare), al
          centro l'orizzonte è appena schiarito, l'acqua più profonda in basso. */}
      <LinearGradient
        colors={[withAlpha(base, 1), withAlpha(base, 0.82), withAlpha(base, 0.12), withAlpha(base, 0.14), withAlpha(base, 0.36), withAlpha(base, 0.54)]}
        locations={[0, 0.16, 0.42, 0.6, 0.8, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Tinta del tema: lo sfondo non resta blu fisso ma segue l'accento scelto. */}
      <LinearGradient
        colors={[withAlpha(colors.atmosTint, 0.06), withAlpha(colors.atmosGlow, 0.08), withAlpha(colors.atmosTint, 0.05)]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(base, 0.04) }]} />
    </Animated.View>
  );
}
