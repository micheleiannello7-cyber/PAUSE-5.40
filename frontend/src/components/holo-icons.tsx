// PAUSE — icone vettoriali olografiche riutilizzabili (famiglia "Ologramma").
// Stesso linguaggio delle icone della bottom bar: superficie "vetro" con
// riflesso bianco in alto + contorno a gradiente iridescente nei colori del
// tema (gradient[0] → brandSecondary → gradient[1]). Seguono SEMPRE il tema
// app (accento + chiaro/scuro). Le versioni raster 3D restano per il tema "3D
// Realistico"; queste si usano quando il tema icone è "Ologramma".
import { useRef } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme, withAlpha } from "@/src/theme";

let _uid = 0;
function useHoloId(prefix: string) {
  const ref = useRef<string | undefined>(undefined);
  if (!ref.current) ref.current = `${prefix}-${++_uid}`;
  return ref.current;
}

export type HoloName = "bulb" | "books" | "heart" | "bookmark" | "share" | "clock" | "headphones";

const CUP_L = "M4.2 13.6 H7 C7.6 13.6 8 14 8 14.6 V18.6 C8 19.2 7.6 19.6 7 19.6 H5.6 C4.8 19.6 4.2 19 4.2 18.2 Z";
const CUP_R = "M19.8 13.6 H17 C16.4 13.6 16 14 16 14.6 V18.6 C16 19.2 16.4 19.6 17 19.6 H18.4 C19.2 19.6 19.8 19 19.8 18.2 Z";

const SW = 1.9;
const P = { strokeWidth: SW, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" as const };

const BULB = "M12 3.4 C8.4 3.4 5.7 6.1 5.7 9.4 C5.7 11.6 6.9 13 8.1 14.2 C8.8 14.9 9.3 15.6 9.5 16.6 H14.5 C14.7 15.6 15.2 14.9 15.9 14.2 C17.1 13 18.3 11.6 18.3 9.4 C18.3 6.1 15.6 3.4 12 3.4 Z";
const BOOK = "M12 6.6 C10 5.3 7.5 4.9 5 5.3 V18 C7.5 17.6 10 18 12 19.2 C14 18 16.5 17.6 19 18 V5.3 C16.5 4.9 14 5.3 12 6.6 Z";
const HEART = "M12 19.6 C12 19.6 4.3 15 4.3 9.6 C4.3 7.1 6.2 5.3 8.5 5.3 C10 5.3 11.3 6.1 12 7.3 C12.7 6.1 14 5.3 15.5 5.3 C17.8 5.3 19.7 7.1 19.7 9.6 C19.7 15 12 19.6 12 19.6 Z";
const BM = "M6.7 4 H17.3 V20.3 L12 15.4 L6.7 20.3 Z";

// Disegna il glifo: `fill` presente = superficie vetro piena (stato olografico).
function Glyph({ name, stroke, fill }: { name: HoloName; stroke: string; fill?: string }) {
  const s = { stroke, ...P };
  const f = fill ? { fill, stroke: "none" as const } : null;
  switch (name) {
    case "bulb":
      return (
        <>
          {f ? <Path d={BULB} {...f} /> : null}
          <Path d={BULB} {...s} />
          <Path d="M9.6 18.3 H14.4" {...s} />
          <Path d="M10.5 20.5 H13.5" {...s} />
        </>
      );
    case "books":
      return (
        <>
          {f ? <Path d={BOOK} {...f} /> : null}
          <Path d={BOOK} {...s} />
          <Path d="M12 6.6 V19.2" {...s} />
        </>
      );
    case "heart":
      return (
        <>
          {f ? <Path d={HEART} {...f} /> : null}
          <Path d={HEART} {...s} />
        </>
      );
    case "bookmark":
      return (
        <>
          {f ? <Path d={BM} {...f} /> : null}
          <Path d={BM} {...s} />
        </>
      );
    case "share":
      return (
        <>
          {f ? (
            <>
              <Circle cx={6.2} cy={12} r={2.4} {...f} />
              <Circle cx={17} cy={6.4} r={2.4} {...f} />
              <Circle cx={17} cy={17.6} r={2.4} {...f} />
            </>
          ) : null}
          <Circle cx={6.2} cy={12} r={2.4} {...s} />
          <Circle cx={17} cy={6.4} r={2.4} {...s} />
          <Circle cx={17} cy={17.6} r={2.4} {...s} />
          <Path d="M8.3 10.9 L14.9 7.5" {...s} />
          <Path d="M8.3 13.1 L14.9 16.5" {...s} />
        </>
      );
    case "headphones":
      return (
        <>
          {f ? <><Path d={CUP_L} {...f} /><Path d={CUP_R} {...f} /></> : null}
          <Path d="M4.4 14.4 V12 C4.4 7.6 7.8 4.4 12 4.4 C16.2 4.4 19.6 7.6 19.6 12 V14.4" {...s} />
          <Path d={CUP_L} {...s} />
          <Path d={CUP_R} {...s} />
        </>
      );
    case "clock":
      return (
        <>
          {f ? <Circle cx={12} cy={12.4} r={8.4} {...f} /> : null}
          <Circle cx={12} cy={12.4} r={8.4} {...s} />
          <Path d="M12 12.4 V7.6" {...s} />
          <Path d="M12 12.4 L15.6 13.9" {...s} />
        </>
      );
  }
}

function HoloDefs({ sId, fId }: { sId: string; fId: string }) {
  const { colors } = useTheme();
  const [g0, g1] = colors.gradient;
  return (
    <Defs>
      <LinearGradient id={sId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={g0} />
        <Stop offset="0.5" stopColor={colors.brandSecondary} />
        <Stop offset="1" stopColor={g1} />
      </LinearGradient>
      <LinearGradient id={fId} x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.24} />
        <Stop offset="0.5" stopColor={colors.brand} stopOpacity={0.12} />
        <Stop offset="1" stopColor={g1} stopOpacity={0} />
      </LinearGradient>
    </Defs>
  );
}

// Icona olografica che riempie il contenitore padre (dimensione data dal
// genitore). `active` = stato olografico pieno; false = solo contorno muted.
export function HoloSymbol({ name, active = true }: { name: HoloName; active?: boolean }) {
  const { colors } = useTheme();
  const id = useHoloId("holo");
  const sId = `${id}-s`;
  const fId = `${id}-f`;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 24 24">
        {active ? <HoloDefs sId={sId} fId={fId} /> : null}
        {active
          ? <Glyph name={name} stroke={`url(#${sId})`} fill={`url(#${fId})`} />
          : <Glyph name={name} stroke={withAlpha(colors.muted, 0.95)} />}
      </Svg>
    </View>
  );
}

// Icona del tempo (orologio) olografica, usata nei badge "N min".
export function HoloClock({ size = 22, testID }: { size?: number; testID?: string }) {
  return (
    <View style={{ width: size, height: size }} testID={testID} pointerEvents="none">
      <HoloSymbol name="clock" />
    </View>
  );
}
