import { Pressable, Text } from "../i18n/ui";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, View } from "react-native";
import { ScreenSafeArea as SafeAreaView } from "../ui/Screen";
import { LocalScreenStack } from "../ui/ScreenStack";
import { appointmentDates, CNAP_CENTER, CNAP_SERVICES, createAppointment, dateLabel, isUpcoming, MAX_APPOINTMENTS, TEST_TIMES, type Appointment } from "../civic/demoCivic";
import { persistAppointments, restoreAppointments } from "../storage/demoCivic";
import { ChoiceRow, civicStyles, civicTheme, PrimaryButton, SecondaryButton, ServiceHeader, ServiceSheet, ServiceTabs, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

type Panel = "none" | "info" | "record";
// One automatic reception location per service; no redundant centre picker.
export const cnapAddress = (serviceId: string) => serviceId === "social" ? "пл. Шандора Петефі, 24" : "пл. Поштова, 3";
export function CnapAppointmentsScreen({ isDarkTheme: dark, onBack }: { isDarkTheme: boolean; onBack: () => void }) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  const [records, setRecords] = useState<Appointment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(0);
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState("");
  const [center, setCenter] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [panel, setPanel] = useState<Panel>("none");
  const [record, setRecord] = useState<Appointment | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // Refresh when returning to the service or progressing: slots are test examples, never API availability.
  const dates = appointmentDates();
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const load = useCallback(async () => {
    setLoaded(false); setError("");
    try { setRecords(await restoreAppointments()); setLoaded(true); }
    catch { setError("Не вдалося прочитати записи. Спробуйте ще раз — наявну історію не буде перезаписано."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const goBack = useCallback(() => {
    if (saving.current) return;
    if (panel !== "none") setPanel("none");
    else if (step > 1) setStep(step - 1);
    else if (step === 1) setStep(0);
    else onBack();
  }, [onBack, panel, step]);
  useHardwareBack(goBack);
  const swipe = useServiceSwipeBack(goBack, !busy);

  function start() {
    setServiceId(""); setCenter(true); setDate(""); setTime(""); setError(""); setJustSaved(false); setStep(1);
  }
  async function save() {
    if (!loaded || saving.current || !center) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const next = createAppointment(serviceId, date, time);
      if (records.some((item) => isUpcoming(item) && item.date === date && item.time === time)) {
        setError("У вас уже є тестовий запис на цей час. Оберіть інший."); return;
      }
      if (records.length >= MAX_APPOINTMENTS) {
        setError(`На пристрої вже збережено ${MAX_APPOINTMENTS} записів. Видаліть непотрібний запис з архіву.`); return;
      }
      const updated = [next, ...records];
      await persistAppointments(updated);
      setRecords(updated); setRecord(next); setJustSaved(true); setStep(0); setTab(0); setPanel("record");
    } catch { setError("Не вдалося зберегти запис. Перевірте дату й час та спробуйте ще раз."); }
    finally { saving.current = false; setBusy(false); }
  }
  async function updateRecord(remove = false) {
    if (!record || saving.current || !loaded) return;
    saving.current = true; setBusy(true); setError("");
    try {
      const updated = remove ? records.filter((item) => item.id !== record.id)
        : records.map((item) => item.id === record.id ? { ...item, cancelledAt: new Date().toISOString() } : item);
      await persistAppointments(updated);
      setRecords(updated); setPanel("none"); setJustSaved(false); setTab(1);
    } catch { setError("Зміни не збережено. Запис залишився без змін — спробуйте ще раз."); }
    finally { saving.current = false; setBusy(false); }
  }
  const visible = records.filter((item) => tab === 0 ? isUpcoming(item, clock) : !isUpcoming(item, clock));
  const serviceTitle = (id: string) => CNAP_SERVICES.find((item) => item.id === id)?.title ?? "Послуга";
  const status = (item: Appointment) => item.cancelledAt ? "Скасовано на пристрої" : isUpcoming(item, clock) ? "Тестовий запис" : "Час тестового візиту минув";
  const ready = loaded && !busy && (step === 1 ? !!serviceId : center && dates.includes(date) && !!time);
  const officialLink = async () => {
    try { await Linking.openURL("https://my.cnap.rada-uzhgorod.gov.ua/"); }
    catch { setError("Не вдалося відкрити офіційний кабінет. Спробуйте ще раз."); }
  };
  const content = <SafeAreaView {...swipe} style={s.screen}>
    <StatusBar style={dark ? "light" : "dark"} />
    <View style={{ flex: 1 }} accessibilityElementsHidden={panel !== "none"} importantForAccessibility={panel !== "none" ? "no-hide-descendants" : "auto"} aria-hidden={panel !== "none"}>
    <ServiceHeader dark={dark} title={step ? "Запис у чергу" : "Запис до ЦНАП"} disabled={busy} onBack={() => { if (!busy) { step ? setStep(0) : onBack(); } }} close={step > 0} onInfo={() => { if (!busy) setPanel("info"); }} />
    {step ? <View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 3, now: step, text: `Крок ${step} з 3` }} style={{ height: 4, backgroundColor: c.border }}><View style={{ height: 4, width: `${step / 3 * 100}%`, backgroundColor: c.accent }} /></View>
    </View> : <ServiceTabs dark={dark} labels={["Записи", "Архів"]} selected={tab} onChange={setTab} />}
    <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={s.content}>
      {!loaded && !error && <ActivityIndicator color={c.accent} accessibilityLabel="Завантажуємо записи" />}
      {error && panel === "none" ? <View accessibilityLiveRegion="polite" style={{ gap: 8 }}><Text style={s.body}>{error}</Text>{!loaded && <PrimaryButton dark={dark} title="Спробувати ще раз" onPress={() => void load()} />}</View> : null}
      {step === 0 && <>
        {tab === 0 && visible.length === 0 && loaded && <View style={s.card}>
          <View style={{ alignItems: "center", paddingVertical: 4 }}><Ionicons name="business-outline" size={36} color={c.accent} /></View>
          <Text accessibilityRole="header" style={[s.title, { textAlign: "center" }]}>Запис в електронну чергу</Text>
          <Text style={[s.body, { textAlign: "center" }]}>Оберіть послугу та зручний час візиту.</Text>
          <PrimaryButton dark={dark} title="Записатися" onPress={start} />
          <Text style={[s.muted, { textAlign: "center" }]}>Тестовий сценарій · до ЦНАП не передається</Text>
        </View>}
        {visible.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${serviceTitle(item.serviceId)}. ${dateLabel(item.date)}, ${item.time}. ${status(item)}. Переглянути запис`} onPress={() => { setRecord(item); setJustSaved(false); setPanel("record"); }} style={s.card}>
          <Text style={s.muted}>{status(item)}</Text><Text style={s.title}>{serviceTitle(item.serviceId)}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="calendar-outline" size={22} color={c.accent} /><Text style={[s.body, { flex: 1 }]}>{dateLabel(item.date)} · {item.time}</Text><Ionicons name="chevron-forward" size={20} color={c.muted} /></View>
          <Text style={s.muted}>{cnapAddress(item.serviceId)}</Text>
        </Pressable>)}
        {tab === 0 && visible.length > 0 && <PrimaryButton dark={dark} title="Новий запис" onPress={start} />}
        {tab === 1 && visible.length === 0 && loaded && <View style={s.empty}><Ionicons name="file-tray-outline" size={64} color={c.muted} /><Text style={[s.title, { textAlign: "center" }]}>Архів поки порожній</Text><Text style={[s.muted, { textAlign: "center" }]}>Тут будуть скасовані записи й записи, час яких минув.</Text></View>}
        {tab === 0 && loaded && <Pressable accessibilityRole="link" onPress={() => void officialLink()} style={[s.iconButton, { flexDirection: "row", gap: 8 }]}><Text style={[s.link, { flexShrink: 1, textAlign: "center" }]}>Офіційний кабінет ЦНАП</Text><Ionicons name="open-outline" size={18} color={c.accent} /></Pressable>}
      </>}
      {step > 0 && <Text style={s.muted}>Крок {step} з 3 · тестовий запис</Text>}
      {step === 1 && <>
        <View style={{ gap: 8 }}><Text accessibilityRole="header" style={s.title}>Послуга</Text><Text style={s.muted}>Що бажаєте отримати?</Text></View>
        <View style={[s.card, { padding: 0 }]}>{CNAP_SERVICES.map((item, index) => <ChoiceRow key={item.id} dark={dark} title={item.title} selected={serviceId === item.id} onPress={() => setServiceId(item.id)} last={index === CNAP_SERVICES.length - 1} />)}</View>
      </>}
      {step === 2 && <>
        <Text accessibilityRole="header" style={s.title}>ЦНАП</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}><Ionicons name="business-outline" size={24} color={c.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={s.body}>{CNAP_CENTER.title}</Text><Text style={s.muted}>{cnapAddress(serviceId)}</Text></View></View>
        <View style={{ gap: 8 }}><Text accessibilityRole="header" style={s.title}>Час візиту</Text><Text style={s.muted}>{center ? "Дати й час — приклади для показу, не вільні місця ЦНАП." : "Спочатку виберіть ЦНАП. Після цього зможете обрати дату й час."}</Text></View>
        {center && <>
          <Text style={s.body}>Дата</Text>
          <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0 }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{dates.map((day) => <Pressable key={day} accessibilityRole="radio" accessibilityLabel={dateLabel(day)} accessibilityState={{ checked: date === day }} onPress={() => { setDate(day); setTime(""); }} style={{ minHeight: 52, width: 124, padding: 10, borderRadius: 10, backgroundColor: date === day ? c.button : c.surface, borderWidth: 1, borderColor: date === day ? c.accent : c.border, justifyContent: "center" }}><Text style={[s.muted, { color: date === day ? "#ffffff" : c.ink, textAlign: "center" }]}>{dateLabel(day)}</Text></Pressable>)}</ScrollView>
          {!!date && <><Text style={s.body}>Час</Text><View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>{TEST_TIMES.map((slot) => <Pressable key={slot} accessibilityRole="radio" accessibilityLabel={slot} accessibilityState={{ checked: time === slot }} onPress={() => setTime(slot)} style={{ minHeight: 48, minWidth: 80, padding: 12, borderRadius: 10, backgroundColor: time === slot ? c.button : c.surface, borderWidth: 1, borderColor: time === slot ? c.accent : c.border }}><Text style={[s.body, { color: time === slot ? "#ffffff" : c.ink, textAlign: "center" }]}>{slot}</Text></Pressable>)}</View></>}
        </>}
      </>}
      {step === 3 && <>
        <Text accessibilityRole="header" style={s.title}>Перевірте запис</Text>
        <View style={s.card}><Text style={s.muted}>Послуга</Text><Text style={s.body}>{serviceTitle(serviceId)}</Text><Text style={s.muted}>Місце прийому</Text><Text style={s.body}>{CNAP_CENTER.title}</Text><Text style={s.body}>{cnapAddress(serviceId)}</Text><Text style={s.muted}>Дата й час</Text><Text style={s.title}>{dateLabel(date)} · {time}</Text></View>
        <Text style={s.muted}>Збережемо приклад запису лише на цьому пристрої. Він не бронює місце в реальній черзі. Персональні дані не потрібні.</Text>
      </>}
    </ScrollView>
    {step > 0 && <View style={s.footer}>
      <View style={s.footerRow}><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Попередній крок" style={s.iconButton} onPress={goBack}><Ionicons name="arrow-back" size={26} color={c.ink} /></Pressable><View style={{ flex: 1 }}><PrimaryButton dark={dark} disabled={!ready} title={busy ? "Зберігаємо…" : step === 3 ? "Зберегти тестовий запис" : "Продовжити"} onPress={() => { if (step < 3) { setError(""); setStep(step + 1); } else void save(); }} /></View></View>
    </View>}
    </View>
    <ServiceSheet dark={dark} visible={panel !== "none"} dismissible={!busy} onClose={() => { if (!busy) { setPanel("none"); if (loaded) setError(""); } }}>
      {panel === "info" && <><Text accessibilityRole="header" style={s.title}>Як працює запис</Text><Text style={s.body}>Оберіть послугу та тестовий час. Місце прийому визначається за послугою. Після підтвердження запис з’явиться у вкладці «Записи».</Text><Text style={s.muted}>Дані зберігаються лише на пристрої й не надходять до ЦНАП. Доступні місця та запис у справжню чергу потребують інтеграції з містом.</Text><PrimaryButton dark={dark} title="Зрозуміло" onPress={() => setPanel("none")} /></>}
      {panel === "record" && record && <>
        <Ionicons name={record.cancelledAt ? "close-circle-outline" : "calendar-outline"} size={40} color={c.accent} />
        <Text accessibilityRole="header" style={s.title}>{justSaved ? "Тестовий запис збережено" : status(record)}</Text>
        <Text style={s.body}>{serviceTitle(record.serviceId)}</Text><Text style={s.title}>{dateLabel(record.date)} · {record.time}</Text><Text style={s.body}>{CNAP_CENTER.title}</Text><Text style={s.body}>{cnapAddress(record.serviceId)}</Text>
        <Text selectable style={s.muted}>Номер прикладу: {record.id}</Text>
        <Text style={s.muted}>Збережено лише на цьому пристрої. Це не талон електронної черги й не підтвердження від ЦНАП.</Text>
        {!!error && <Text accessibilityLiveRegion="polite" style={s.body}>{error}</Text>}
        {isUpcoming(record, clock) ? <PrimaryButton dark={dark} disabled={busy} title={busy ? "Зберігаємо…" : "Скасувати тестовий запис"} onPress={() => void updateRecord()} /> : <PrimaryButton dark={dark} disabled={busy} title={busy ? "Видаляємо…" : "Видалити з архіву"} onPress={() => void updateRecord(true)} />}
        <SecondaryButton dark={dark} disabled={busy} title="Закрити" onPress={() => { setPanel("none"); setError(""); }} />
      </>}
    </ServiceSheet>
  </SafeAreaView>;
  return <LocalScreenStack path={Array.from({ length: step + 1 }, (_, index) => `cnap:${index}`)} backgroundColor={c.bg}>{content}</LocalScreenStack>;
}
