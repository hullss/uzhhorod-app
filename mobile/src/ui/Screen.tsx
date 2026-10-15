import { useLayoutEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, StyleSheet, useWindowDimensions, type ViewProps } from "react-native";
import { SafeAreaView as NativeSafeAreaView } from "react-native-safe-area-context";
import { useScreenActive } from "./ScreenActivity";
export { useScreenActive } from "./ScreenActivity";

/** A deliberate edge gesture, with direct finger tracking and a cancellable spring. */
export function useAnimatedBack(onBack: () => void, enabled = true, blocked?: { readonly current: boolean }) {
  const active = useScreenActive();
  const progress = useRef(new Animated.Value(0)).current;
  const callback = useRef(onBack); callback.current = onBack;
  const allowed = useRef(enabled && active); allowed.current = enabled && active;
  const width = useWindowDimensions().width;
  const phase = useRef({ finishing: false, handoff: false, revision: 0, width });
  const mounted = useRef(true);
  useLayoutEffect(() => {
    const state = phase.current;
    if (state.handoff || !enabled || !active || state.width !== width) {
      state.revision++; state.handoff = false; state.finishing = false; state.width = width;
      progress.stopAnimation(); progress.setValue(0);
    }
  });
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; phase.current.revision++; progress.stopAnimation(); };
  }, [progress]);
  return useMemo(() => {
    let multiTouch = false;
    const canNavigate = () => allowed.current && !blocked?.current;
    const reset = () => Animated.spring(progress, { toValue: 0, speed: 24, bounciness: 0, useNativeDriver: true }).start();
    const responder = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, g) => canNavigate() && !phase.current.finishing && g.numberActiveTouches === 1 && g.x0 <= 32 && g.dx > 12 && g.dx > Math.abs(g.dy) * 1.6,
      onPanResponderGrant: () => { multiTouch = false; phase.current.revision++; progress.stopAnimation(); },
      onPanResponderMove: (_, g) => { if (g.numberActiveTouches > 1) multiTouch = true; progress.setValue(canNavigate() && !multiTouch ? Math.max(0, Math.min(width, g.dx)) : 0); },
      onPanResponderTerminationRequest: (_, g) => !canNavigate() || g.numberActiveTouches > 1,
      onPanResponderTerminate: reset,
      onPanResponderRelease: (_, g) => {
        if (phase.current.finishing) return;
        if (!canNavigate() || multiTouch || g.numberActiveTouches > 1 || !(g.dx > Math.min(100, width * .28) || (g.dx > 45 && g.vx > .6))) { reset(); return; }
        phase.current.finishing = true;
        const revision = ++phase.current.revision;
        const remaining = width - Math.max(0, Math.min(width, g.dx));
        Animated.timing(progress, { toValue: width, duration: Math.round(Math.max(70, Math.min(180, remaining / width * 220))), useNativeDriver: true }).start(({ finished }) => {
          if (!mounted.current || revision !== phase.current.revision) return;
          if (!finished || !canNavigate()) { phase.current.finishing = false; reset(); return; }
          // Keep the outgoing page offscreen until React commits the pop.
          // For local form steps the same hook survives; reset in layout phase,
          // before the newly active previous step can be painted with this value.
          phase.current.handoff = true;
          callback.current();
        });
      },
    });
    return { ...responder.panHandlers, swipeProgress: progress };
  }, [progress, width, blocked]);
}

export function ScreenSafeArea({ swipeProgress, bottomNavigation = false, style, children, ...props }: ViewProps & {
  swipeProgress?: Animated.Value; bottomNavigation?: boolean;
}) {
  const active = useScreenActive();
  return <Animated.View {...props} style={[styles.fill, style, swipeProgress && active && { transform: [{ translateX: swipeProgress }], shadowColor: "#000", shadowOpacity: .16, shadowRadius: 12, shadowOffset: { width: -3, height: 0 }, elevation: 8 }]}>
    <NativeSafeAreaView style={styles.fill} edges={bottomNavigation ? ["top", "left", "right"] : ["top", "left", "right", "bottom"]}>{children}</NativeSafeAreaView>
  </Animated.View>;
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
