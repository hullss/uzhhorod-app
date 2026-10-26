import { Pressable, Text } from "../i18n/ui";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, BackHandler, Modal, PanResponder, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAnimatedBack, useScreenActive } from "../ui/Screen";
import { APP_FONTS } from "../ui/fonts";
import { PAGE_LAYOUT } from "../ui/layout";
import { themeTokens } from "../ui/themeTokens";

export function civicTheme(dark: boolean) {
  return themeTokens(dark);
}
export function civicStyles(dark: boolean) {
  const c = civicTheme(dark);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: PAGE_LAYOUT.gutter, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface },
    headerTitle: { flex: 1, textAlign: "center", color: c.ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 17, lineHeight: 23 },
    iconButton: { minWidth: 44, minHeight: 48, alignItems: "center", justifyContent: "center" },
    content: { flexGrow: 1, width: "100%", maxWidth: 760, alignSelf: "center", padding: PAGE_LAYOUT.gutter, gap: 16, paddingBottom: PAGE_LAYOUT.bottom },
    title: { color: c.ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 19, lineHeight: 26 },
    body: { color: c.ink, fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 15, lineHeight: 22 },
    muted: { color: c.muted, fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19 },
    link: { color: c.accent, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 15, lineHeight: 22 },
    card: { backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 16, gap: 12 },
    empty: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, paddingVertical: 40 },
    tabs: { flexDirection: "row", backgroundColor: c.soft, borderRadius: 10, padding: 3, marginHorizontal: PAGE_LAYOUT.gutter, marginVertical: 12 },
    tab: { flex: 1, minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, justifyContent: "center", alignItems: "center", borderRadius: 8 },
    tabActive: { backgroundColor: c.surface },
    tabText: { color: c.ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 15, lineHeight: 22, textAlign: "center" },
    button: { minHeight: 44, backgroundColor: c.button, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    buttonText: { color: "#ffffff", fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 14, lineHeight: 20, textAlign: "center" },
    buttonDisabled: { backgroundColor: c.soft, borderWidth: 1, borderColor: c.border },
    buttonDisabledText: { color: c.muted },
    row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingVertical: 10, paddingHorizontal: 14 },
    divider: { borderBottomColor: c.border, borderBottomWidth: 1 },
    radio: { height: 20, width: 20, borderRadius: 10, borderWidth: 1.5, borderColor: c.muted, justifyContent: "center", alignItems: "center" },
    selectedRadio: { borderColor: c.accent },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
    rowText: { flex: 1, color: c.ink, fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 15, lineHeight: 22 },
    footer: { padding: PAGE_LAYOUT.gutter, borderTopWidth: 1, borderColor: c.border, gap: 12, backgroundColor: c.surface },
    footerRow: { flexDirection: "row", gap: 12, alignItems: "center" },
    scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
    sheet: { backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%" },
    handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: c.border, alignSelf: "center", marginTop: 12, marginBottom: 4 },
  });
}
type Props = { dark: boolean };
export function useHardwareBack(onBack: () => void) {
  const active = useScreenActive();
  useEffect(() => {
    if (!active) return;
    const listener = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => listener.remove();
  }, [onBack, active]);
}
export function useServiceSwipeBack(onBack: () => void, enabled = true, blocked?: { readonly current: boolean }) {
  return useAnimatedBack(onBack, enabled, blocked);
}
export function ServiceHeader({ dark, title, onBack, onInfo, close = false, disabled = false, backLabel }: Props & { title: string; onBack: () => void; onInfo?: () => void; close?: boolean; disabled?: boolean; backLabel?: string }) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  return <View style={s.header}>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} accessibilityLabel={backLabel ?? (close ? "Закрити запис" : "Назад")} style={s.iconButton} onPress={onBack}><Ionicons name={close ? "close" : "arrow-back"} size={24} color={disabled ? c.muted : c.ink} /></Pressable>
    <Text accessibilityRole="header" style={s.headerTitle}>{title}</Text>
    {onInfo ? <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} accessibilityLabel="Інформація про сервіс" style={s.iconButton} onPress={onInfo}><Ionicons name="information-circle-outline" size={25} color={disabled ? c.muted : c.ink} /></Pressable> : <View style={s.iconButton} />}
  </View>;
}
export function ServiceTabs({ dark, labels, selected, onChange }: Props & { labels: [string, string]; selected: number; onChange: (index: number) => void }) {
  const s = civicStyles(dark);
  return <View style={s.tabs}>{labels.map((label, index) => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: selected === index }} onPress={() => onChange(index)} style={[s.tab, selected === index && s.tabActive]}><Text style={s.tabText}>{label}</Text></Pressable>)}</View>;
}
export function PrimaryButton({ dark, title, onPress, disabled = false }: Props & { title: string; onPress: () => void; disabled?: boolean }) {
  const s = civicStyles(dark);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, disabled && s.buttonDisabled]}><Text style={[s.buttonText, disabled && s.buttonDisabledText]}>{title}</Text></Pressable>;
}
export function SecondaryButton({ dark, title, onPress, disabled = false }: Props & { title: string; onPress: () => void; disabled?: boolean }) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[s.button, { backgroundColor: c.soft }]}><Text style={[s.buttonText, { color: disabled ? c.muted : c.accent }]}>{title}</Text></Pressable>;
}
export function ChoiceRow({ dark, title, selected, onPress, disabled = false, last = false }: Props & { title: string; selected: boolean; onPress: () => void; disabled?: boolean; last?: boolean }) {
  const s = civicStyles(dark);
  return <Pressable accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: selected, disabled }} disabled={disabled} style={[s.row, !last && s.divider]} onPress={onPress}>
    <View style={[s.radio, selected && s.selectedRadio]}>{selected && <View style={s.dot} />}</View><Text style={s.rowText}>{title}</Text>
  </Pressable>;
}
export function ServiceSheet({ dark, visible: requestedVisible, onClose, children, dismissible = true }: Props & { visible: boolean; onClose: () => void; children: ReactNode; dismissible?: boolean }) {
  const active = useScreenActive(); const visible = requestedVisible && active;
  const s = civicStyles(dark);
  const offset = useRef(new Animated.Value(900)).current;
  const rendered = useRef(children);
  if (visible) rendered.current = children; // Keep content intact during native dismissal.
  const closeRef = useRef(onClose); closeRef.current = onClose;
  const closing = useRef(false); const allowed = useRef(dismissible); allowed.current = dismissible;
  useEffect(() => {
    if (visible) { closing.current = false; offset.setValue(900); Animated.timing(offset, { toValue: 0, duration: 220, useNativeDriver: true }).start(); }
    return () => offset.stopAnimation();
  }, [visible, offset]);
  const close = () => {
    if (closing.current || !allowed.current) return;
    closing.current = true;
    Animated.timing(offset, { toValue: 900, duration: 180, useNativeDriver: true }).start(({ finished }) => { if (finished) closeRef.current(); else closing.current = false; });
  };
  const drag = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => allowed.current && !closing.current,
    onPanResponderGrant: () => offset.stopAnimation(),
    onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
    onPanResponderRelease: (_, g) => {
      if (!allowed.current) { offset.setValue(0); return; }
      if (g.dy > 70 || (g.dy > 25 && g.vy > .6)) {
        if (closing.current) return;
        closing.current = true;
        Animated.timing(offset, { toValue: 900, duration: 180, useNativeDriver: true }).start(({ finished }) => { if (finished) closeRef.current(); else closing.current = false; });
      } else Animated.spring(offset, { toValue: 0, speed: 24, bounciness: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => offset.setValue(0),
  }).panHandlers, [offset]);
  return <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
    <View style={s.scrim}>
      <Pressable accessibilityRole="button" accessibilityLabel="Закрити панель" onPress={close} style={StyleSheet.absoluteFill} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: offset }] }]}>
        <SafeAreaView edges={["bottom"]} accessibilityViewIsModal role="dialog" aria-modal style={{ flexShrink: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12 }}>
            <View {...drag} style={{ flex: 1, minHeight: 44, justifyContent: "center" }}><View style={s.handle} /></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрити панель" style={s.iconButton} onPress={close}><Ionicons name="close" size={22} color={civicTheme(dark).ink} /></Pressable>
          </View>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={[s.content, { flexGrow: 0 }]} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>{rendered.current}</ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  </Modal>;
}
