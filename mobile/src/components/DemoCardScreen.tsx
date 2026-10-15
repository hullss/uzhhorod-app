import { useRef, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput } from "../i18n/ui";
import type { DemoPaymentCard } from "../storage/demoPaymentCard";
import { ScreenSafeArea } from "../ui/Screen";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export const TEST_CARD_NUMBER = "4242 4242 4242 4242";
export function validDemoCardFields(number: string, expiry: string, cvv: string) {
  const digits = number.replace(/\D/g, "");
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry);
  if (digits !== "4242424242424242" || !match || !/^\d{3}$/.test(cvv)) return false;
  const now = new Date();
  return Number(match[2]) + 2000 > now.getFullYear() || (Number(match[2]) + 2000 === now.getFullYear() && Number(match[1]) >= now.getMonth() + 1);
}
export function DemoCardScreen({ dark, card, onBack, onSave, onRemove, storageNotice }: { dark: boolean; card: DemoPaymentCard | null; onBack: () => void; onSave: (c: DemoPaymentCard) => void | Promise<void>; onRemove: () => void | Promise<void>; storageNotice?: ReactNode }) {
  const [busy, setBusy] = useState(false); const locked = useRef(false);
  const back = () => { if (!locked.current) onBack(); };
  const s = civicStyles(dark); const c = civicTheme(dark); const swipe = useServiceSwipeBack(back, !busy); useHardwareBack(back);
  const [number, setNumber] = useState(TEST_CARD_NUMBER); const [expiry, setExpiry] = useState("12/30");
  const [cvv, setCvv] = useState("123"); const [label, setLabel] = useState(""); const [error, setError] = useState("");
  const input = { minHeight: 48, borderWidth: 1, borderColor: dark ? "#7399b9" : "#73879d", backgroundColor: c.surface, borderRadius: 10, padding: 12, fontSize: 16, color: c.ink };
  const reset = () => { setNumber(TEST_CARD_NUMBER); setExpiry("12/30"); setCvv("123"); setError(""); };
  const save = async () => {
    if (locked.current) return;
    if (!validDemoCardFields(number, expiry, cvv)) { setError("Для показу використайте тестову картку 4242 4242 4242 4242, чинну дату та 3 цифри CVV."); return; }
    locked.current = true; setBusy(true); setError("");
    try { await onSave({ label: label.trim() || "Тестова картка", last4: "4242" }); setCvv(""); setNumber(""); setExpiry(""); }
    catch { setError("Картку не збережено. Спробуйте ще раз."); }
    finally { locked.current = false; setBusy(false); }
  };
  const remove = async () => {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError("");
    try { await onRemove(); reset(); }
    catch { setError("Картку не видалено. Спробуйте ще раз."); }
    finally { locked.current = false; setBusy(false); }
  };
  return <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title="Способи оплати" disabled={busy} onBack={back} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      <Text style={s.muted}>Тестова картка · без списання коштів. Не вводьте справжні реквізити.</Text>
      {storageNotice}
      {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
      {card ? <>
        <View style={{ borderRadius: 16, padding: 20, gap: 24, backgroundColor: dark ? "#174b75" : "#123a63" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Text translate={false} style={[s.body, { color: "#fff", flex: 1 }]}>{card.label}</Text><Ionicons name="card-outline" size={25} color="#fff" /></View>
          <Text translate={false} style={[s.title, { color: "#fff", letterSpacing: 1, fontSize: 20 }]}>{card.last4 === "4242" ? TEST_CARD_NUMBER : `•••• •••• •••• ${card.last4}`}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={[s.muted, { color: "#d3e4ff" }]}>ТЕСТОВА КАРТКА</Text><Ionicons name="checkmark-circle" size={21} color="#fff" /></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} style={s.iconButton} onPress={() => void remove()}><Text style={s.link}>Видалити картку</Text></Pressable>
      </> : <>
        <View style={[s.card, { gap: 14 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={s.body}>Банківська картка</Text><Ionicons name="card-outline" size={24} color={c.accent} /></View>
          <View style={{ gap: 6 }}><Text style={s.muted}>Номер картки</Text><TextInput editable={!busy} accessibilityLabel="Номер тестової картки" autoComplete="off" keyboardType="number-pad" maxLength={19} value={number} onChangeText={v => { setNumber(v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()); setError(""); }} style={input} /></View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1, gap: 6 }}><Text style={s.muted}>Дійсна до</Text><TextInput editable={!busy} accessibilityLabel="Термін дії тестової картки" autoComplete="off" keyboardType="number-pad" maxLength={5} placeholder="ММ/РР" placeholderTextColor={c.muted} value={expiry} onChangeText={v => { const digits = v.replace(/\D/g, "").slice(0, 4); setExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits); setError(""); }} style={input} /></View>
            <View style={{ flex: 1, gap: 6 }}><Text style={s.muted}>CVV</Text><TextInput editable={!busy} accessibilityLabel="CVV тестової картки" autoComplete="off" keyboardType="number-pad" maxLength={3} secureTextEntry value={cvv} onChangeText={v => { setCvv(v.replace(/\D/g, "").slice(0, 3)); setError(""); }} style={input} /></View>
          </View>
          <View style={{ gap: 6 }}><Text style={s.muted}>Назва картки</Text><TextInput editable={!busy} accessibilityLabel="Назва картки" maxLength={40} placeholder="Наприклад, Основна" placeholderTextColor={c.muted} value={label} onChangeText={setLabel} style={input} /></View>
        </View>
        <PrimaryButton dark={dark} title={busy ? "Зберігаємо…" : "Додати тестову картку"} disabled={busy} onPress={() => void save()} />
      </>}
      <Text style={s.muted}>На пристрої зберігаємо лише назву й останні 4 цифри. Номер, термін дії та CVV не зберігаються й не надсилаються.</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}><Ionicons name="phone-portrait-outline" size={22} color={c.muted} /><View style={{ flex: 1 }}><Text style={s.body}>Apple Pay / Google Pay</Text><Text style={s.muted}>Поки недоступно</Text></View><Ionicons name="time-outline" size={20} color={c.muted} /></View>
    </ScrollView>
  </ScreenSafeArea>;
}
