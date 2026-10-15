import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput, useLanguage } from "../i18n/ui";
import { getLocale } from "../i18n/locale";
import { ScreenSafeArea } from "../ui/Screen";
import { LocalScreenStack } from "../ui/ScreenStack";
import type { DemoPaymentCard } from "../storage/demoPaymentCard";
import { formatDemoMoney, normalizeVehiclePlate } from "../payments/demoTransport";
import { findParkingZone, PARKING_ZONES, quoteParking, type ParkingSession } from "../payments/parkingSession";
import { payForParking, restoreParkingSessions } from "../storage/parkingSessions";
import { ChoiceRow, civicStyles, civicTheme, PrimaryButton, ServiceHeader, ServiceSheet, ServiceTabs, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";
import { ParkingMap } from "./ParkingMap";

type Step = "sessions" | "zone" | "vehicle" | "method" | "review";
export function ParkingDemoScreen({ dark, card, onBack }: { dark: boolean; card: DemoPaymentCard | null; onBack: () => void }) {
  useLanguage();
  const s = civicStyles(dark); const c = civicTheme(dark);
  const [tab, setTab] = useState(0); const [step, setStep] = useState<Step>("sessions");
  const [zoneId, setZoneId] = useState<string>(PARKING_ZONES[0].id); const [plate, setPlate] = useState(""); const [hours, setHours] = useState(1);
  const [method, setMethod] = useState<"example" | "saved">(card ? "saved" : "example");
  const [sessions, setSessions] = useState<ParkingSession[]>([]); const [extendId, setExtendId] = useState<string>();
  const [loading, setLoading] = useState(true); const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [info, setInfo] = useState(false);
  const [success, setSuccess] = useState(false);
  const [mapInteracting, setMapInteracting] = useState(false);
  const mapInteraction = useRef(false); const scroll = useRef<ScrollView>(null);
  const currentStep = useRef(step); currentStep.current = step;
  const [now, setNow] = useState(Date.now()); const locked = useRef(false); const mounted = useRef(true); const requestId = useRef("");
  const last4 = method === "saved" && card ? card.last4 : "4242";
  const quote = quoteParking(zoneId, hours);
  const onMapInteraction = (active: boolean) => {
    if (currentStep.current !== step) return;
    if (mapInteraction.current === active) return;
    mapInteraction.current = active;
    // Lock before the next React frame: a map drag near the edge is not a back swipe.
    scroll.current?.setNativeProps({ scrollEnabled: !active });
    if (mounted.current) setMapInteracting(active);
  };
  const load = async () => {
    setLoading(true); setError("");
    try { const items = await restoreParkingSessions(); if (mounted.current) { setSessions(items); setLoadFailed(false); } }
    catch { if (mounted.current) { setLoadFailed(true); setError("Не вдалося прочитати історію паркування."); } }
    finally { if (mounted.current) setLoading(false); }
  };
  useEffect(() => {
    mounted.current = true; void load();
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    const resume = AppState.addEventListener("change", state => { onMapInteraction(false); if (state === "active") setNow(Date.now()); });
    return () => { mounted.current = false; clearInterval(timer); resume.remove(); };
  }, []);
  const back = () => {
    if (locked.current) return;
    if (info) { setInfo(false); return; }
    setError("");
    if (step === "review") setStep("method");
    else if (step === "method") setStep("vehicle");
    else if (step === "vehicle") { if (!PARKING_ZONES.some(zone => zone.id === zoneId)) setZoneId(PARKING_ZONES[0].id); setStep("sessions"); }
    else if (step === "zone") setStep("vehicle");
    else onBack();
  };
  useHardwareBack(back); const swipe = useServiceSwipeBack(back, !busy, mapInteraction);
  const begin = (current?: ParkingSession) => {
    setExtendId(current?.id); setPlate(current?.plate ?? ""); setHours(1); setError(""); setSuccess(false);
    setZoneId(current?.zoneId ?? (PARKING_ZONES.some(zone => zone.id === zoneId) ? zoneId : PARKING_ZONES[0].id)); setMethod(card ? "saved" : "example");
    requestId.current = `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
    setStep("vehicle");
  };
  const pay = async () => {
    if (locked.current || loadFailed) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await payForParking({ zoneId, plate, hours, last4, requestId: requestId.current }, extendId);
      if (mounted.current) { setSessions(result); setNow(Date.now()); setStep("sessions"); setTab(0); setSuccess(true); setExtendId(undefined); if (!PARKING_ZONES.some(zone => zone.id === zoneId)) setZoneId(PARKING_ZONES[0].id); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Не вдалося зберегти паркування. Спробуйте ще раз."); }
    finally { locked.current = false; if (mounted.current) setBusy(false); }
  };
  const time = (value: string) => new Date(value).toLocaleString(getLocale(), { timeZone: "Europe/Kyiv", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const active = sessions.filter(item => Date.parse(item.endsAt) > now);
  const history = sessions.filter(item => Date.parse(item.endsAt) <= now);
  const zoneName = (id: string) => findParkingZone(id)?.name ?? "Майданчик";
  const renderMap = () => <>
    <View style={{ height: 290, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: c.border }}>
      <ParkingMap dark={dark} zones={PARKING_ZONES} selectedId={zoneId} onSelect={setZoneId} onInteractionChange={onMapInteraction} />
    </View>
    <Text style={s.muted}>Схематичні ділянки · 25 грн/год для показу</Text>
    <View style={[s.card, { padding: 0, gap: 0, overflow: "hidden" }]}>
      {PARKING_ZONES.map((zone, index) => <Pressable key={zone.id} accessibilityRole="radio" aria-checked={zoneId === zone.id} accessibilityState={{ checked: zoneId === zone.id }} accessibilityLabel={zone.name}
        onPress={() => setZoneId(zone.id)} style={[s.row, index < PARKING_ZONES.length - 1 && s.divider, { minHeight: 66, backgroundColor: zoneId === zone.id ? c.soft : c.surface }]}>
        <View style={{ width: 32, minHeight: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name={zoneId === zone.id ? "checkmark-circle" : "location-outline"} size={23} color={zoneId === zone.id ? c.accent : c.muted} /></View>
        <View style={{ flex: 1, gap: 3 }}><Text style={[s.body, { fontWeight: zoneId === zone.id ? "600" : "400" }]}>{zone.name}</Text><Text style={s.muted}>25 грн/год</Text></View>
      </Pressable>)}
    </View>
  </>;
  const renderSession = (item: ParkingSession, isActive: boolean) => <View key={item.id} style={s.card}>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}><Ionicons name="car-outline" size={24} color={c.accent} /><Text translate={false} style={[s.title, { flex: 1, letterSpacing: 1 }]}>{item.plate}</Text><Text style={s.muted}>{isActive ? "Активне" : "Завершено"}</Text></View>
    <Text style={s.body}>{zoneName(item.zoneId)}</Text><Text style={s.muted}>{time(item.startedAt)} — {time(item.endsAt)}</Text>
    {isActive && <View style={{ backgroundColor: c.soft, borderRadius: 10, padding: 12, gap: 4 }}><Text style={[s.title, { fontVariant: ["tabular-nums"] }]}>Залишилося: {Math.max(0, Math.ceil((Date.parse(item.endsAt) - now) / 60_000))} хв</Text><Text style={s.muted}>Тестова сесія · не підтверджує право на паркування</Text></View>}
    <Text style={s.body}>{formatDemoMoney(item.charges.reduce((sum, charge) => sum + charge.amountKopiykas, 0))} · •••• {item.charges.at(-1)?.last4}</Text>
    {isActive && item.charges.length < 20 && <PrimaryButton dark={dark} title="Продовжити паркування" onPress={() => begin(item)} />}
  </View>;
  const content = <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title={extendId && step !== "sessions" ? "Продовження паркування" : "Паркування"} disabled={busy} onBack={back} onInfo={() => { if (!busy) setInfo(true); }} />
    {step === "sessions" && <ServiceTabs dark={dark} labels={["Мапа", "Історія"]} selected={tab} onChange={setTab} />}
    <View style={{ paddingHorizontal: 20, paddingVertical: 8, flexDirection: "row", gap: 7, alignItems: "center" }}><Ionicons name="flask-outline" size={15} color={c.muted} /><Text style={s.muted}>Тестовий режим · без списання коштів</Text></View>
    <ScrollView ref={node => { if (currentStep.current === step) scroll.current = node; }} scrollEnabled={!mapInteracting} pinchGestureEnabled={false} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      {!!error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
      {success && step === "sessions" && tab === 0 && <Text accessibilityRole="alert" style={s.link}>Тестову сесію збережено</Text>}
      {loading ? <ActivityIndicator color={c.accent} /> : loadFailed ? <PrimaryButton dark={dark} title="Спробувати ще раз" onPress={() => void load()} /> : <>
        {step === "sessions" && (tab === 0 ? <>
          {active.map(item => renderSession(item, true))}
          <Text style={s.title}>{active.length ? "Ще один майданчик" : "Де паркуємося?"}</Text>
          {renderMap()}
        </> : <>{history.map(item => renderSession(item, false))}{!history.length && <View style={s.empty}><Ionicons name="time-outline" size={48} color={c.muted} /><Text style={s.title}>Історія поки порожня</Text><Text style={s.muted}>Завершені паркування з’являться тут.</Text></View>}</>)}
        {step === "zone" && <><Text style={s.title}>Виберіть майданчик</Text>{renderMap()}</>}
        {step === "vehicle" && <>
          <View style={s.card}><Text style={s.title}>{zoneName(zoneId)}</Text><Text style={s.muted}>{formatDemoMoney(quote.zone.hourlyKopiykas)} / год</Text>{!extendId && <Pressable accessibilityRole="button" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => setStep("zone")}><Text style={s.link}>Змінити майданчик</Text></Pressable>}</View>
          <Text style={s.title}>Ваше авто</Text><Text style={s.body}>Номер авто</Text><TextInput value={plate} onChangeText={value => { setPlate(value); setError(""); }} editable={!extendId} autoCapitalize="characters" autoCorrect={false} maxLength={12} placeholder="AO 1234 AA" accessibilityLabel="Номер авто" placeholderTextColor={c.muted} style={{ minHeight: 56, backgroundColor: c.surface, borderWidth: 1, borderColor: c.controlBorder, borderRadius: 10, padding: 14, color: c.ink, fontSize: 20, fontWeight: "600", letterSpacing: 1.5 }} />
          <Text style={s.muted}>Введіть повний номер з номерного знака.</Text>
          <View style={[s.card, { flexDirection: "row", alignItems: "center" }]}><Text style={[s.body, { flex: 1 }]}>Тривалість</Text><Pressable disabled={hours <= 1} accessibilityRole="button" accessibilityLabel="Зменшити тривалість" accessibilityState={{ disabled: hours <= 1 }} style={s.iconButton} onPress={() => setHours(value => value - 1)}><Ionicons name="remove" size={22} color={hours <= 1 ? c.muted : c.accent} /></Pressable><Text style={s.body}>{hours} год</Text><Pressable disabled={hours >= 8} accessibilityRole="button" accessibilityLabel="Збільшити тривалість" accessibilityState={{ disabled: hours >= 8 }} style={s.iconButton} onPress={() => setHours(value => value + 1)}><Ionicons name="add" size={22} color={hours >= 8 ? c.muted : c.accent} /></Pressable></View>
        </>}
        {step === "method" && <><Text style={s.title}>Спосіб оплати</Text><View style={[s.card, { padding: 0, gap: 0 }]}>{card && <ChoiceRow dark={dark} title={`${card.label} · •••• ${card.last4}`} selected={method === "saved"} onPress={() => setMethod("saved")} />}<ChoiceRow dark={dark} title="Тестова картка · •••• 4242" selected={method === "example"} onPress={() => setMethod("example")} last /></View></>}
        {step === "review" && <><Text style={s.title}>Перевірте оплату</Text><View style={s.card}><Text style={s.body}>{zoneName(zoneId)}</Text><View style={[s.footerRow, { borderTopWidth: 1, borderColor: c.border, paddingTop: 12 }]}><Text style={[s.muted, { flex: 1 }]}>Номер авто</Text><Text translate={false} style={[s.title, { letterSpacing: 1 }]}>{normalizeVehiclePlate(plate)}</Text></View><View style={s.footerRow}><Text style={[s.muted, { flex: 1 }]}>Тривалість</Text><Text style={s.body}>{hours} год</Text></View><View style={s.footerRow}><Text style={[s.muted, { flex: 1 }]}>Картка</Text><Text translate={false} style={s.body}>•••• {last4}</Text></View><View style={[s.footerRow, { borderTopWidth: 1, borderColor: c.border, paddingTop: 12 }]}><Text style={[s.body, { flex: 1 }]}>До сплати</Text><Text style={s.title}>{formatDemoMoney(quote.amountKopiykas)}</Text></View>{extendId && <Text style={s.muted}>Час додамо до завершення поточної сесії.</Text>}</View><Text style={s.muted}>Кошти не списуються. Це показ сценарію, а не справжня оплата паркування.</Text></>}
      </>}
    </ScrollView>
    {!loading && !loadFailed && step === "sessions" && tab === 0 && <View style={s.footer}><View style={s.footerRow}><Text style={[s.body, { flex: 1 }]}>{zoneName(zoneId)}</Text><Text style={s.link}>{formatDemoMoney(quote.zone.hourlyKopiykas)} / год</Text></View><PrimaryButton dark={dark} title="Нове паркування" onPress={() => begin()} /></View>}
    {!loading && !loadFailed && step !== "sessions" && <View style={s.footer}><View style={s.footerRow}><Text style={[s.body, { flex: 1 }]}>До сплати</Text><Text style={s.title}>{formatDemoMoney(quote.amountKopiykas)}</Text></View>{busy ? <ActivityIndicator accessibilityLabel="Зберігаємо…" color={c.accent} /> : <PrimaryButton dark={dark} title={step === "review" ? "Підтвердити тестову оплату" : "Продовжити"} disabled={step === "vehicle" && !normalizeVehiclePlate(plate)} onPress={() => { setError(""); if (step === "zone") setStep("vehicle"); else if (step === "vehicle") setStep("method"); else if (step === "method") setStep("review"); else void pay(); }} />}</View>}
    <ServiceSheet dark={dark} visible={info} dismissible={!busy} onClose={() => setInfo(false)}><Text style={s.title}>Як працює паркування</Text><Text style={s.body}>Виберіть майданчик, авто й тривалість, спосіб оплати та підтвердьте суму. Активну сесію можна продовжити; історія збережеться на цьому пристрої.</Text><Text style={s.body}>Демонстраційні локації: межі схематичні, 25 грн/год — тариф для показу. Точні межі, графік і чинну вартість потрібно підтвердити з оператором.</Text><Text style={s.muted}>Сесія не надходить оператору чи інспектору, не видає дозволу на паркування й не списує коштів. Реальні зони, тарифи, перевірку інспекторами та оплату підключимо після погодження з оператором.</Text><Pressable accessibilityRole="link" style={{ minHeight: 44, justifyContent: "center" }} onPress={() => { void Linking.openURL("https://www.openstreetmap.org/copyright").catch(() => setError("Не вдалося відкрити джерело мапи.")); }}><Text style={s.link}>Координати вулиць: OpenStreetMap · ODbL ↗</Text></Pressable></ServiceSheet>
  </ScreenSafeArea>;
  const path = step === "sessions" ? ["sessions"] : step === "zone" ? ["sessions", "vehicle", "zone"]
    : step === "vehicle" ? ["sessions", "vehicle"] : step === "method" ? ["sessions", "vehicle", "method"] : ["sessions", "vehicle", "method", "review"];
  return <LocalScreenStack path={path} backgroundColor={c.bg}>{content}</LocalScreenStack>;
}
