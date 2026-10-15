import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ScreenActivity, useScreenActive } from "./ScreenActivity";
import type { NavigationFrame } from "./navigation";

/** Keep ancestors mounted at full size; only the top screen accepts input. */
export function ScreenStack({ frames, render, backgroundColor, retainRoots = false }: {
  frames: NavigationFrame[]; render: (frame: NavigationFrame) => ReactNode;
  backgroundColor: string; retainRoots?: boolean;
}) {
  const parentActive = useScreenActive();
  const [roots, setRoots] = useState<NavigationFrame[]>([]);
  const root = frames[0];
  useEffect(() => {
    if (retainRoots && root) setRoots(previous => previous.some(item => item.key === root.key) ? previous : [...previous, root]);
  }, [retainRoots, root?.key]);
  const retained = retainRoots ? roots.filter(item => !frames.some(frame => frame.key === item.key)) : [];
  const top = frames.at(-1)?.key, behind = frames.at(-2)?.key;
  return <View style={[styles.fill, { backgroundColor, overflow: "hidden" }]}>
    {[...retained, ...frames].map((frame, index) => {
      const active = parentActive && frame.key === top;
      const visible = frame.key === top || frame.key === behind;
      return <ScreenLayer key={frame.key} active={active} visible={visible} index={index}>{render(frame)}</ScreenLayer>;
    })}
  </View>;
}

function ScreenLayer({ active, visible, index, children }: { active: boolean; visible: boolean; index: number; children: ReactNode }) {
  const layer = useRef<View>(null);
  useEffect(() => {
    // A focused button on a retained web page must not keep it in the AX tree.
    if (active && Platform.OS === "web" && layer.current) {
      const node = layer.current as unknown as HTMLElement;
      const foreground = Array.from(node.querySelectorAll<HTMLElement>('[data-testid="navigation-screen"]'))
        .filter(item => !item.closest('[aria-hidden="true"]')).at(-1) ?? node;
      foreground.focus({ preventScroll: true });
    }
  }, [active]);
  return <ScreenActivity.Provider value={active}>
    <View ref={layer} testID="navigation-screen" tabIndex={-1} {...(Platform.OS === "web" ? { inert: !active } : {})} pointerEvents={active ? "auto" : "none"} accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"} aria-hidden={!active}
      style={[StyleSheet.absoluteFill, { zIndex: index, display: visible ? "flex" : "none" }]}>
      {children}
    </View>
  </ScreenActivity.Provider>;
}

/** Local form steps share state; cache their rendered ancestors and scroll views. */
export function LocalScreenStack({ path, children, backgroundColor }: {
  path: string[]; children: ReactNode; backgroundColor: string;
}) {
  const cached = useRef(new Map<string, ReactNode>());
  const top = path.at(-1)!;
  cached.current.set(top, children);
  for (const key of cached.current.keys()) if (!path.includes(key)) cached.current.delete(key);
  return <ScreenStack frames={path.filter(key => cached.current.has(key)).map(key => ({ key, kind: key }))}
    render={frame => cached.current.get(frame.key)} backgroundColor="transparent" />;
}
const styles = StyleSheet.create({ fill: { flex: 1 } });
