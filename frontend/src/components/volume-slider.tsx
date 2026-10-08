// PAUSE — slider del volume effetti (0..1). Niente dipendenze esterne: usa il
// sistema di responder di React Native (funziona anche sul web del preview).
// Si appoggia alla misura in finestra della traccia per calcolare la frazione.
import React, { useCallback, useRef, useState } from "react";
import { View, PanResponder, LayoutChangeEvent, DimensionValue } from "react-native";
import { makeStyles } from "@/src/theme";

export function VolumeSlider({
  value,
  onChange,
  onCommit,
  testID,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: (v: number) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const [fill, setFill] = useState(value);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);
  const fillRef = useRef(value);
  const trackRef = useRef<View>(null);

  const measure = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, w) => {
      pageXRef.current = x;
      if (w) widthRef.current = w;
    });
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      widthRef.current = e.nativeEvent.layout.width;
      measure();
    },
    [measure],
  );

  const apply = useCallback(
    (pageX: number, commit?: boolean) => {
      const w = widthRef.current;
      if (!w) return;
      let f = (pageX - pageXRef.current) / w;
      f = Math.max(0, Math.min(1, f));
      fillRef.current = f;
      setFill(f);
      onChange(f);
      if (commit) onCommit?.(f);
    },
    [onChange, onCommit],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        measure();
        apply(e.nativeEvent.pageX);
      },
      onPanResponderMove: (e) => apply(e.nativeEvent.pageX),
      onPanResponderRelease: (e) => apply(e.nativeEvent.pageX, true),
      onPanResponderTerminate: () => onCommit?.(fillRef.current),
    }),
  ).current;

  const pct: DimensionValue = `${Math.round(fill * 100)}%`;

  return (
    <View
      ref={trackRef}
      onLayout={onLayout}
      style={styles.track}
      testID={testID}
      {...pan.panHandlers}
    >
      <View style={styles.trackBg} />
      <View style={[styles.trackFill, { width: pct }]} />
      <View style={[styles.thumb, { left: pct }]} />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  track: { height: 36, justifyContent: "center" },
  trackBg: {
    position: "absolute", left: 0, right: 0, top: 15, height: 6, borderRadius: 3,
    backgroundColor: colors.glassBorderStrong,
  },
  trackFill: {
    position: "absolute", left: 0, top: 15, height: 6, borderRadius: 3,
    backgroundColor: colors.cyan,
    boxShadow: `0px 0px 10px ${colors.cyanGlowSoft}` as any,
  },
  thumb: {
    position: "absolute", top: 9, width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.cyan,
    transform: [{ translateX: -9 }],
    boxShadow: `0px 0px 10px ${colors.cyanGlow}` as any,
  },
}));
