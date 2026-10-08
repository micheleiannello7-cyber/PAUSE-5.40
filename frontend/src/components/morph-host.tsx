// PAUSE — livello "ospite" sopra tutto lo stack (anche sopra la barra dei tab):
// ci vive la transizione card Home → lettura (story-morph). Chi apre la storia
// vi monta l'overlay; il lettore, appena disegnato sotto, lo congeda con una
// dissolvenza breve. Finché è attivo assorbe i tocchi (niente doppi tap).
// Per il ritorno, la Home registra qui (solo ref, nessun ri-render) come
// misurare la card attiva e segnala quando il suo layout è di nuovo stabile:
// il livello rientra nella cornice reale della card, non in quella di partenza.
import { createContext, MutableRefObject, ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

export type HostRect = { x: number; y: number; width: number; height: number };

/** Nodo nativo misurabile (View, Animated.View). */
type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null | undefined;

type MorphHostCtx = {
  show: (node: ReactNode) => void; dismiss: () => void; clear: () => void; active: boolean;
  /** Cornice di un nodo NELLE COORDINATE DEL LIVELLO (non della finestra): su
   *  Android `measureInWindow` è spostato dell'altezza della barra di stato
   *  rispetto al livello, quindi si misura anche il livello e si sottrae. */
  measureInHost: (node: Measurable) => Promise<HostRect | null>;
  /** Il lettore sotto è disegnato e stabile: il livello può dissolversi appena finisce la sua animazione. */
  ready: boolean; markReady: () => void;
  /** Home: misura la card attiva del mazzo (coordinate finestra). */
  homeCard: MutableRefObject<(() => Promise<HostRect | null>) | null>;
  /** Home: fa rientrare logo e categorie insieme al livello che torna nella card. */
  homeReturn: MutableRefObject<(() => void) | null>;
  /** Ritorno: prima di tornare alla Home si arma l'attesa; la Home segnala quando il layout è stabile. */
  armHomeSettle: () => void; homeSettled: () => void; waitHomeSettled: (timeoutMs: number) => Promise<void>;
};

const noop = () => {};
const Ctx = createContext<MorphHostCtx>({
  show: noop, dismiss: noop, clear: noop, active: false, ready: false, markReady: noop, measureInHost: () => Promise.resolve(null),
  homeCard: { current: null }, homeReturn: { current: null },
  armHomeSettle: noop, homeSettled: noop, waitHomeSettled: () => Promise.resolve(),
});

export const useMorphHost = () => useContext(Ctx);

export function MorphHost({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  const [ready, setReady] = useState(false);
  const fade = useSharedValue(1);
  const clear = useCallback(() => setNode(null), []);
  const show = useCallback((next: ReactNode) => { fade.value = 1; setReady(false); setNode(next); }, [fade]);
  const markReady = useCallback(() => setReady(true), []);
  const dismiss = useCallback(() => {
    fade.value = withTiming(0, { duration: 150, easing: Easing.out(Easing.quad) }, (done) => { if (done) runOnJS(clear)(); });
  }, [fade, clear]);
  const homeCard = useRef<(() => Promise<HostRect | null>) | null>(null);
  const homeReturn = useRef<(() => void) | null>(null);
  const hostRef = useRef<View>(null);
  const measureInHost = useCallback((node: Measurable) => new Promise<HostRect | null>((resolve) => {
    const host = hostRef.current;
    if (!node?.measureInWindow || !host?.measureInWindow) { resolve(null); return; }
    node.measureInWindow((x, y, w, h) => {
      if (!(w > 0 && h > 0)) { resolve(null); return; }
      host.measureInWindow((hx, hy) => resolve({ x: x - hx, y: y - hy, width: w, height: h }));
    });
  }), []);
  const settled = useRef(true);
  const waiters = useRef<(() => void)[]>([]);
  const armHomeSettle = useCallback(() => { settled.current = false; }, []);
  const homeSettled = useCallback(() => {
    settled.current = true;
    const list = waiters.current; waiters.current = [];
    list.forEach((resolve) => resolve());
  }, []);
  const waitHomeSettled = useCallback((timeoutMs: number) => new Promise<void>((resolve) => {
    if (settled.current) { resolve(); return; }
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(finish, timeoutMs);
    waiters.current.push(finish);
  }), []);
  const style = useAnimatedStyle(() => ({ opacity: fade.value }));
  const value = useMemo(() => ({
    show, dismiss, clear, active: node != null, ready, markReady, measureInHost, homeCard, homeReturn, armHomeSettle, homeSettled, waitHomeSettled,
  }), [show, dismiss, clear, node, ready, markReady, measureInHost, armHomeSettle, homeSettled, waitHomeSettled]);
  return (
    <Ctx.Provider value={value}>
      <View style={styles.fill} ref={hostRef} collapsable={false}>
        {children}
        {node != null ? (
          // Android: l'opacità va applicata al livello INTERO (non figlio per
          // figlio, com'è di default): altrimenti, a metà dissolvenza, testo e
          // copertina si attenuano anche se sotto c'è una schermata identica.
          <Animated.View style={[StyleSheet.absoluteFill, style]} testID="morph-host" needsOffscreenAlphaCompositing>{node}</Animated.View>
        ) : null}
      </View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
