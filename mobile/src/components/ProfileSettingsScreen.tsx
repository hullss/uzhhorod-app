import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput } from "../i18n/ui";
import { ScreenSafeArea } from "../ui/Screen";
import type { ThemeMode } from "../storage/preferences";
import { translate } from "../i18n/locale";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export function SegmentedChoice<T extends string>({ dark, value, options, onChange, disabled = false, label }: { dark: boolean; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; disabled?: boolean; label?: string }) {
  const c = civicTheme(dark); const s = civicStyles(dark);
  return <View accessibilityRole="radiogroup" accessibilityLabel={label && translate(label)} style={{ flexDirection: "row", backgroundColor: c.soft, borderRadius: 12, padding: 3 }}>{options.map(o => <Pressable key={o.value} disabled={disabled} accessibilityRole="radio" accessibilityLabel={o.label} accessibilityState={{ checked: value === o.value, disabled }} onPress={() => onChange(o.value)} style={{ flex: 1, minHeight: 44, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: o.value === value ? c.surface : "transparent", justifyContent: "center", alignItems: "center" }}><Text style={[s.body, { fontWeight: o.value === value ? "600" : "400", textAlign: "center", color: disabled ? c.muted : c.ink }]}>{o.label}</Text></Pressable>)}</View>;
}
export function ProfileSettingsScreen({ dark, language, theme, onLanguage, onTheme, onHomeServices, onNotifications, onLegal, onAccount, onAbout, onBack, storageNotice, controlsDisabled = false }: {
  dark: boolean; language: "uk" | "en"; theme: ThemeMode; onLanguage: (v: "uk" | "en") => void;
  onTheme: (v: ThemeMode) => void; onNotifications: () => void; onLegal: () => void; onBack: () => void;
  onAccount: () => void; onAbout: () => void; onHomeServices: () => void;
  storageNotice?: ReactNode;
  controlsDisabled?: boolean;
}) {
  const s = civicStyles(dark); const c = civicTheme(dark); const swipe = useServiceSwipeBack(onBack); useHardwareBack(onBack);
  const { width, fontScale } = useWindowDimensions();
  const stackLanguage = width < 360 || fontScale > 1.3;
  return <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title="Налаштування" onBack={onBack} />
    <ScrollView contentContainerStyle={s.content}>
      {storageNotice}
      <View style={[s.card, { gap: 20 }]}>
        <View style={{ gap: 12, flexDirection: stackLanguage ? "column" : "row", alignItems: stackLanguage ? "stretch" : "center" }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: stackLanguage ? undefined : 1 }}><Ionicons name="globe-outline" size={23} color={c.ink} /><Text style={s.body}>Мова</Text></View><View style={{ width: stackLanguage ? "100%" : 150 }}><SegmentedChoice dark={dark} disabled={controlsDisabled} value={language} label="Мова" options={[{ value: "uk", label: "Укр" }, { value: "en", label: "En" }]} onChange={onLanguage} /></View></View>
        <View style={{ gap: 12 }}><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Ionicons name="contrast-outline" size={23} color={c.ink} /><Text style={s.body}>Тема</Text></View><SegmentedChoice dark={dark} disabled={controlsDisabled} value={theme} label="Тема" options={[{ value: "system", label: "Системна" }, { value: "light", label: "Світла" }, { value: "dark", label: "Темна" }]} onChange={onTheme} /></View>
      </View>
      <View style={[s.card, { padding: 0, gap: 0 }]}>{[{ icon: "grid-outline" as const, title: "Сервіси на головній", action: onHomeServices }, { icon: "notifications-outline" as const, title: "Сповіщення", action: onNotifications }, { icon: "person-outline" as const, title: "Акаунт", action: onAccount }, { icon: "shield-checkmark-outline" as const, title: "Правила та приватність", action: onLegal }, { icon: "information-circle-outline" as const, title: "Про застосунок", action: onAbout }].map((row, index, rows) => <Pressable key={row.title} accessibilityRole="button" accessibilityLabel={row.title} onPress={row.action} style={[s.row, index < rows.length - 1 && s.divider]}><Ionicons name={row.icon} size={22} color={c.accent} /><Text style={[s.body, { flex: 1 }]}>{row.title}</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>)}</View>
      <Text style={s.muted}>Ужгород Цифровий · 1.0</Text>
    </ScrollView>
  </ScreenSafeArea>;
}
export function PersonalDetailsScreen({ dark, name, onSave, onBack, disabled = false }: { dark: boolean; name: string; onSave: (v: string) => void; onBack: () => void; disabled?: boolean }) {
  const [value, setValue] = useState(name); const s = civicStyles(dark); const c = civicTheme(dark); const swipe = useServiceSwipeBack(onBack); useHardwareBack(onBack);
  useEffect(() => { setValue(name); }, [name]);
  return <ScreenSafeArea {...swipe} style={s.screen}><ServiceHeader dark={dark} title="Особисті дані" onBack={onBack} /><ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={s.content}>
    <Text style={s.body}>Як до вас звертатися?</Text><TextInput editable={!disabled} accessibilityLabel="Ім’я" placeholder="Ім’я" placeholderTextColor={c.muted} value={value} onChangeText={setValue} maxLength={50} autoComplete="given-name" style={{ minHeight: 52, borderRadius: 10, padding: 14, backgroundColor: c.surface, color: c.ink, borderWidth: 1, borderColor: c.border, fontSize: 16 }} />
    <PrimaryButton dark={dark} title="Зберегти" disabled={disabled} onPress={() => { onSave(value.trim()); onBack(); }} /><Text style={s.muted}>Ім’я зберігається лише на цьому пристрої.</Text>
  </ScrollView></ScreenSafeArea>;
}
