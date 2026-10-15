import { getLocale } from "../i18n/locale";
import { Alert, Pressable, Text, TextInput } from "../i18n/ui";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, ScrollView, StyleSheet, View } from "react-native";
import { ScreenSafeArea as SafeAreaView, useAnimatedBack, useScreenActive } from "../ui/Screen";
import { LocalScreenStack } from "../ui/ScreenStack";
import { PaymentQrScanner } from "./PaymentQrScanner";
import { createDemoTicket, DEMO_FARE_KOPIYKAS, DEMO_VEHICLE_PLATE, formatDemoMoney, normalizeVehiclePlate, vehicleFromDemoQr, type DemoTicket } from "../payments/demoTransport";
import { CITY_TIME_ZONE } from "../utils/cityTime";
import { PAGE_LAYOUT } from "../ui/layout";
import { APP_FONTS } from "../ui/fonts";
import { ServiceHeader } from "./CivicServiceUI";
import { StorageRecoveryNotice } from "./StorageRecoveryNotice";
import { themeTokens } from "../ui/themeTokens";

type ViewName = "choose" | "scan" | "review" | "processing" | "ticket" | "history";
type SavedCard = { label: string; last4: string };

export function DemoTransportPaymentScreen({ card, tickets, initialView = "choose", backLabel = "До сервісів", isDarkTheme, active: requestedActive = true, historyReady = true, historyError = false, onRetryHistory = () => undefined, onBack, onManagePaymentMethods, onTicketCreated, onClearTickets }: {
  card: SavedCard | null;
  tickets: DemoTicket[];
  initialView?: "choose" | "history";
  backLabel?: string;
  isDarkTheme: boolean;
  active?: boolean;
  historyReady?: boolean;
  historyError?: boolean;
  onRetryHistory?: () => void;
  onBack: () => void;
  onManagePaymentMethods: () => void;
  onTicketCreated: (ticket: DemoTicket) => void | Promise<void>;
  onClearTickets: () => void | Promise<void>;
}) {
  const focused = useScreenActive(); const active = requestedActive && focused;
  const [view, setView] = useState<ViewName>(initialView);
  const [plateInput, setPlateInput] = useState("");
  const [plate, setPlate] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<"test" | "saved">("test");
  const [source, setSource] = useState<DemoTicket["source"]>("number");
  const [qrUsedExample, setQrUsedExample] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<DemoTicket | null>(null);
  const [returnFromTicket, setReturnFromTicket] = useState<"choose" | "history">("choose");
  const paymentLocked = useRef(false);
  const onTicketCreatedRef = useRef(onTicketCreated);
  const previousCard = useRef(card);
  onTicketCreatedRef.current = onTicketCreated;
  const s = useMemo(() => makeStyles(isDarkTheme), [isDarkTheme]);
  const { ink, accent, muted, soft } = themeTokens(isDarkTheme);
  const total = DEMO_FARE_KOPIYKAS * quantity;
  const last4 = method === "saved" && card ? card.last4 : "4242";

  function back() {
    if (view === "processing") return;
    if (view === "scan" || view === "review") {
      paymentLocked.current = false;
      setError(null);
      setView("choose");
    } else if (view === "ticket") setView(returnFromTicket);
    else if (view === "history" && initialView !== "history") setView("choose");
    else onBack();
  }
  const swipe = useAnimatedBack(back, active && view !== "processing");

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { back(); return true; });
    return () => subscription.remove();
  }, [active, view, returnFromTicket, initialView, onBack]);

  useEffect(() => {
    // A card added from this checkout becomes the selected method; cancelling
    // leaves the selection unchanged. Removing a card restores the test method.
    if (!card) setMethod("test");
    else if (!previousCard.current) setMethod("saved");
    previousCard.current = card;
  }, [card]);

  useEffect(() => {
    if (!active || view !== "processing") return;
    // The delay only demonstrates processing; no network call or financial transaction occurs.
    let mounted = true;
    const timer = setTimeout(async () => {
      try {
        const receipt = createDemoTicket(plate, quantity, last4, source);
        await onTicketCreatedRef.current(receipt);
        if (!mounted) return;
        setTicket(receipt);
        setReturnFromTicket("choose");
        setView("ticket");
      } catch (paymentError) {
        if (mounted) {
          setError("Не вдалося зберегти квиток. Оплату не завершено; спробуйте ще раз.");
          setView("review");
        }
      } finally {
        paymentLocked.current = false;
      }
    }, 1100);
    return () => { mounted = false; clearTimeout(timer); };
  }, [active, view, plate, quantity, last4, source]);

  function reviewNumber(value: string) {
    const normalized = normalizeVehiclePlate(value);
    if (!normalized) {
      setError(`Введіть повний номер: дві літери, чотири цифри, дві літери. Наприклад, ${DEMO_VEHICLE_PLATE}.`);
      return;
    }
    setPlate(normalized);
    setPlateInput(normalized);
    setSource("number");
    setError(null);
    setView("review");
  }

  function scanQr(payload: string) {
    const vehicle = vehicleFromDemoQr(payload);
    setPlate(vehicle.plate);
    setPlateInput(vehicle.plate);
    setSource("qr");
    setQrUsedExample(vehicle.usedExample);
    setError(null);
    setView("review");
  }

  function submit() {
    if (!historyReady || paymentLocked.current || (method === "saved" && !card)) return;
    paymentLocked.current = true;
    setError(null);
    setView("processing");
  }

  function row(label: string, value: string) {
    return <View style={s.detailRow}><Text style={s.detailLabel}>{label}</Text><Text style={s.detailValue}>{value}</Text></View>;
  }

  const stepKey = view === "processing" ? "review" : view;
  const stepPath = initialView === "history" ? (view === "ticket" ? ["history", "ticket"] : ["history"])
    : view === "ticket" && returnFromTicket === "history" ? ["choose", "history", "ticket"]
    : stepKey === "choose" ? ["choose"] : ["choose", stepKey];
  const content = view === "scan" ? <SafeAreaView {...swipe} style={s.scannerScreen}>
    <StatusBar style="light" />
    <PaymentQrScanner onScan={scanQr} onClose={back} onManual={() => { setView("choose"); setError(null); }} />
  </SafeAreaView> : <SafeAreaView {...swipe} style={s.screen}>
    <StatusBar style={isDarkTheme ? "light" : "dark"} />
    <ServiceHeader dark={isDarkTheme} title={view === "ticket" ? "Ваш квиток" : view === "history" ? "Мої квитки" : "Оплата проїзду"} onBack={back} disabled={view === "processing"} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
      {!historyReady && (historyError ? <StorageRecoveryNotice dark={isDarkTheme} onRetry={onRetryHistory} /> : <ActivityIndicator accessibilityLabel="Відновлюємо історію…" color={accent} />)}

      {view === "choose" ? <>
        <Text style={s.subtitle}>Зчитайте QR у салоні або введіть державний номер автобуса.</Text>
        <Pressable accessibilityRole="button" onPress={() => setView("scan")} style={s.scanButton}>
          <View style={s.scanIcon}><Ionicons name="qr-code-outline" size={27} color={accent} /></View>
          <View style={s.flex}><Text style={s.optionTitle}>Сканувати QR</Text><Text style={s.optionHint}>Наведіть камеру на код у салоні</Text></View>
          <Ionicons name="chevron-forward" size={19} color={muted} />
        </Pressable>
        <View style={s.divider}><View style={s.dividerLine} /><Text style={s.optionHint}>або за номером</Text><View style={s.dividerLine} /></View>
        <Text style={s.label}>Державний номер автомобіля</Text>
        <TextInput accessibilityLabel="Державний номер автобуса" accessibilityHint={`Наприклад, ${DEMO_VEHICLE_PLATE}. Введіть номер з таблички автобуса.`} autoCapitalize="characters" autoCorrect={false} maxLength={12} placeholder={DEMO_VEHICLE_PLATE} placeholderTextColor={muted} value={plateInput} onChangeText={(value) => { setPlateInput(value.toUpperCase()); setError(null); }} onSubmitEditing={() => reviewNumber(plateInput)} returnKeyType="done" style={s.plateInput} />
        <Text style={s.helper}>Введіть повний номер з таблички автобуса, не номер маршруту.</Text>
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" onPress={() => reviewNumber(plateInput)} style={s.primary}><Text style={s.primaryText}>Продовжити</Text><Ionicons name="arrow-forward" size={19} color="#ffffff" /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => reviewNumber(DEMO_VEHICLE_PLATE)} style={s.textButton}><Text style={s.link}>Спробувати з {DEMO_VEHICLE_PLATE}</Text></Pressable>
        <View style={s.note}><Ionicons name="information-circle-outline" size={19} color={accent} /><Text style={s.noteText}>Демонстраційна оплата. Реальні кошти не списуються, квитки не дійсні для проїзду.</Text></View>
        <Pressable accessibilityRole="button" onPress={() => setView("history")} style={s.historyLink}><Ionicons name="ticket-outline" size={21} color={accent} /><Text style={[s.link, s.flex]}>Мої квитки</Text><Text style={s.optionHint}>{tickets.length}</Text><Ionicons name="chevron-forward" size={18} color={muted} /></Pressable>
      </> : null}

      {view === "review" || view === "processing" ? <>
        {source === "qr" ? <View style={s.qrResult}><Ionicons name="checkmark-circle" size={21} color={accent} /><Text style={s.qrResultText}>{qrUsedExample ? "QR зчитано. Для демо обрано тестовий автобус." : "QR зчитано. Номер використано для тестової поїздки."}</Text></View> : null}
        <View style={s.vehicle}><View style={s.vehicleIcon}><Ionicons name="bus-outline" size={27} color={accent} /></View><View style={s.flex}><Text style={s.optionHint}>Державний номер</Text><Text style={s.plate}>{plate}</Text></View></View>
        <View style={s.summary}>
          <View style={s.quantityRow}><View style={s.flex}><Text style={s.optionTitle}>Разова поїздка</Text><Text style={s.optionHint}>{formatDemoMoney(DEMO_FARE_KOPIYKAS)} за пасажира</Text></View><View style={s.counter}>
            <Pressable accessibilityLabel="Зменшити кількість пасажирів" accessibilityRole="button" accessibilityState={{ disabled: quantity <= 1 || view === "processing" }} disabled={quantity <= 1 || view === "processing"} onPress={() => setQuantity((value) => value - 1)} style={s.counterButton}><Ionicons name="remove" size={19} color={quantity <= 1 ? muted : accent} /></Pressable>
            <Text accessibilityLabel={`Пасажирів: ${quantity}`} style={s.quantity}>{quantity}</Text>
            <Pressable accessibilityLabel="Збільшити кількість пасажирів" accessibilityRole="button" accessibilityState={{ disabled: quantity >= 5 || view === "processing" }} disabled={quantity >= 5 || view === "processing"} onPress={() => setQuantity((value) => value + 1)} style={s.counterButton}><Ionicons name="add" size={19} color={quantity >= 5 ? muted : accent} /></Pressable>
          </View></View>
          <Text style={s.helper}>{formatDemoMoney(DEMO_FARE_KOPIYKAS)} — умовна ціна для демонстрації, не офіційний тариф.</Text>
          <View style={s.totalRow}><Text style={s.optionTitle}>Разом</Text><Text style={s.total}>{formatDemoMoney(total)}</Text></View>
        </View>
        <Text style={s.sectionTitle}>Спосіб оплати</Text>
        <Pressable accessibilityRole="radio" aria-checked={method === "test"} accessibilityLabel="Тестова картка · 4242" accessibilityState={{ checked: method === "test", disabled: view === "processing" }} disabled={view === "processing"} onPress={() => setMethod("test")} style={[s.method, method === "test" && s.selectedMethod]}>
          <Ionicons name="card-outline" size={24} color={accent} /><View style={s.flex}><Text style={s.optionTitle}>Тестова картка · 4242</Text><Text style={s.optionHint}>Готова до демонстрації</Text></View><Ionicons name={method === "test" ? "radio-button-on" : "radio-button-off"} size={22} color={accent} />
        </Pressable>
        {card && <Pressable accessibilityRole="radio" aria-checked={method === "saved"} accessibilityLabel={`${card.label} · ${card.last4}`} accessibilityState={{ checked: method === "saved", disabled: view === "processing" }} disabled={view === "processing"} onPress={() => setMethod("saved")} style={[s.method, method === "saved" && s.selectedMethod]}><Ionicons name="card-outline" size={24} color={accent} /><View style={s.flex}><Text style={s.optionTitle}>{card.label} · {card.last4}</Text><Text style={s.optionHint}>Макет картки з профілю · тестовий платіж</Text></View><Ionicons name={method === "saved" ? "radio-button-on" : "radio-button-off"} size={22} color={accent} /></Pressable>}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: view === "processing" }} disabled={view === "processing"} onPress={onManagePaymentMethods} style={s.textButton}><Text style={s.link}>{card ? "Керувати карткою" : "Додати макет картки у профілі"}</Text></Pressable>
        {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !historyReady || view === "processing", busy: view === "processing" }} disabled={!historyReady || view === "processing"} onPress={submit} style={[s.primary, !historyReady && { backgroundColor: soft }]}>
          {view === "processing" ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="lock-closed-outline" size={18} color={historyReady ? "#ffffff" : muted} />}<Text style={[s.primaryText, !historyReady && { color: muted }]}>{view === "processing" ? "Обробляємо тестову оплату…" : `Оплатити ${formatDemoMoney(total)}`}</Text>
        </Pressable>
        <Text style={s.paymentFootnote}>Тестовий режим · банк не підключено · списання коштів немає</Text>
      </> : null}

      {view === "ticket" && ticket ? <>
        <View accessibilityLiveRegion="polite" style={s.success}><Ionicons name="checkmark-circle" size={30} color={isDarkTheme ? "#9dd38f" : "#3d6836"} /><View style={s.flex}><Text style={s.successTitle}>Тестова оплата успішна</Text><Text style={s.optionHint}>Квиток додано до історії</Text></View></View>
        <View style={s.ticket}>
          <View style={s.ticketHeader}><Text style={s.ticketEyebrow}>УЖГОРОД ЦИФРОВИЙ</Text><Ionicons name="bus-outline" size={24} color={accent} /></View>
          <Text style={s.ticketTitle}>Разова поїздка</Text>
          <Text style={s.ticketPlate}>{ticket.plate}</Text>
          <View style={s.ticketCode}><Ionicons name="ticket-outline" size={48} color={accent} /><Text selectable style={s.ticketId}>{ticket.id}</Text></View>
          {row("Час", formatTicketDate(ticket.paidAt))}
          {row("Пасажирів", String(ticket.quantity))}
          {row("Сума", formatDemoMoney(ticket.amountKopiykas))}
          {row("Картка", `•••• ${ticket.cardLast4}`)}
          <View style={s.ticketWarning}><Text style={s.ticketWarningText}>ТЕСТОВИЙ КВИТОК · НЕ ДІЙСНИЙ ДЛЯ ПРОЇЗДУ</Text></View>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setView("history")} style={s.primary}><Text style={s.primaryText}>Мої квитки</Text><Ionicons name="arrow-forward" size={19} color="#ffffff" /></Pressable>
        <Pressable accessibilityRole="button" onPress={() => { setView("choose"); setPlateInput(""); setQuantity(1); }} style={s.textButton}><Text style={s.link}>Оплатити ще одну поїздку</Text></Pressable>
      </> : null}

      {view === "history" ? <>
        <Text style={s.subtitle}>Тестові поїздки на цьому пристрої.</Text>
        {!tickets.length ? historyReady && <View style={s.empty}><Ionicons name="ticket-outline" size={42} color={accent} /><Text style={s.emptyTitle}>Тут будуть ваші квитки</Text><Text style={s.helper}>Пройдіть тестову оплату — квиток збережеться тут.</Text></View> : tickets.map((item) => <Pressable accessibilityRole="button" accessibilityLabel={`Відкрити тестовий квиток ${item.plate}, ${formatDemoMoney(item.amountKopiykas)}, ${formatTicketDate(item.paidAt)}`} key={item.id} onPress={() => { setTicket(item); setReturnFromTicket("history"); setView("ticket"); }} style={s.historyItem}><View style={s.historyIcon}><Ionicons name="bus-outline" size={23} color={accent} /></View><View style={s.flex}><Text style={s.optionTitle}>{item.plate}</Text><Text style={s.optionHint}>{formatTicketDate(item.paidAt)} · {item.quantity} пас.</Text></View><Text style={s.historyAmount}>{formatDemoMoney(item.amountKopiykas)}</Text><Ionicons name="chevron-forward" size={17} color={muted} /></Pressable>)}
        <Pressable accessibilityRole="button" onPress={() => { setView("choose"); setPlateInput(""); }} style={s.primary}><Text style={s.primaryText}>Нова поїздка</Text><Ionicons name="add" size={20} color="#ffffff" /></Pressable>
        {tickets.length && historyReady ? <Pressable accessibilityRole="button" style={s.textButton} onPress={() => Alert.alert("Очистити тестові квитки?", "Історію демонстраційних поїздок буде видалено з цього пристрою.", [{ text: "Залишити", style: "cancel" }, { text: "Очистити", style: "destructive", onPress: () => { void Promise.resolve().then(onClearTickets).catch(() => Alert.alert("Історія не збережена", "Зміни не збережено. Спробуйте ще раз.")); } }])}><Text style={s.link}>Очистити тестову історію</Text></Pressable> : null}
      </> : null}
    </ScrollView>
  </SafeAreaView>;
  return <LocalScreenStack path={stepPath} backgroundColor={s.screen.backgroundColor}>{content}</LocalScreenStack>;
}

function formatTicketDate(value: string) {
  return new Date(value).toLocaleString(getLocale(), { timeZone: CITY_TIME_ZONE, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function makeStyles(dark: boolean) {
  const { bg, surface, soft, ink, muted, accent, controlBorder: border, border: separator, button: action } = themeTokens(dark);
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: bg }, scannerScreen: { flex: 1, backgroundColor: "#071b2f" },
    content: { paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.top, paddingBottom: PAGE_LAYOUT.bottom }, flex: { flex: 1, minWidth: 0 },
    back: { flexDirection: "row", alignItems: "center", minHeight: 48, gap: 4, alignSelf: "flex-start" },
    backText: { fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 13, color: ink },
    heading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: PAGE_LAYOUT.gap, marginTop: PAGE_LAYOUT.block },
    title: { fontFamily: APP_FONTS.bold, fontWeight: "700", fontSize: 27, color: ink, flex: 1 },
    demoBadge: { backgroundColor: soft, borderRadius: 6, padding: 7 }, demoBadgeText: { fontFamily: APP_FONTS.semibold, fontWeight: "600", color: accent, fontSize: 10, letterSpacing: 0.5 },
    subtitle: { fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 21, color: muted, marginTop: 9 },
    scanButton: { flexDirection: "row", alignItems: "center", gap: PAGE_LAYOUT.gap, backgroundColor: surface, borderColor: separator, borderWidth: 1, borderRadius: 15, padding: PAGE_LAYOUT.block, minHeight: 88, marginTop: PAGE_LAYOUT.section },
    scanIcon: { backgroundColor: soft, alignItems: "center", justifyContent: "center", borderRadius: 12, height: 50, width: 50 },
    optionTitle: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 14, lineHeight: 20, color: ink },
    optionHint: { fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, color: muted, marginTop: 3 },
    divider: { flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 24 }, dividerLine: { height: 1, backgroundColor: separator, flex: 1 },
    label: { fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 13, color: ink, marginBottom: 9 },
    plateInput: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 22, letterSpacing: 2, color: ink, backgroundColor: surface, borderColor: border, borderWidth: 1, borderRadius: 12, minHeight: 62, paddingHorizontal: PAGE_LAYOUT.block, paddingVertical: PAGE_LAYOUT.gap },
    helper: { fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, color: muted, marginTop: 9 },
    error: { fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 13, lineHeight: 19, color: dark ? "#ffb4ad" : "#a31d1d", marginTop: 12 },
    primary: { flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center", padding: PAGE_LAYOUT.block, minHeight: 54, borderRadius: 12, backgroundColor: action, marginTop: PAGE_LAYOUT.section },
    primaryText: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 14, lineHeight: 20, color: "#ffffff", textAlign: "center", flexShrink: 1 },
    textButton: { alignItems: "center", justifyContent: "center", minHeight: 48, padding: 9, marginTop: 5 }, link: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 13, color: accent },
    note: { alignItems: "flex-start", flexDirection: "row", gap: 9, marginTop: PAGE_LAYOUT.section }, noteText: { fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, color: muted, flex: 1 },
    historyLink: { flexDirection: "row", alignItems: "center", gap: 12, borderTopColor: separator, borderTopWidth: 1, paddingVertical: 15, minHeight: 58, marginTop: 24 },
    step: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 10, color: muted, letterSpacing: 0.7, marginTop: 18 },
    qrResult: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 15 }, qrResultText: { fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, color: accent, flex: 1 },
    vehicle: { alignItems: "center", flexDirection: "row", gap: 14, marginVertical: 22 }, vehicleIcon: { backgroundColor: soft, borderRadius: 12, height: 50, width: 50, alignItems: "center", justifyContent: "center" },
    plate: { color: ink, fontFamily: APP_FONTS.bold, fontWeight: "700", fontSize: 23, letterSpacing: 1, marginTop: 4 },
    summary: { backgroundColor: surface, borderRadius: 14, padding: 16, borderColor: separator, borderWidth: 1 },
    quantityRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 }, counter: { flexDirection: "row", alignItems: "center", gap: 2 },
    counterButton: { width: 44, height: 44, borderRadius: 9, backgroundColor: soft, alignItems: "center", justifyContent: "center" },
    quantity: { color: ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 17, minWidth: 24, textAlign: "center" },
    totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopColor: separator, borderTopWidth: 1, paddingTop: 16, marginTop: 15, gap: 10 },
    total: { color: ink, fontFamily: APP_FONTS.bold, fontWeight: "700", fontSize: 26 }, sectionTitle: { color: ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 15, marginTop: 25, marginBottom: 6 },
    method: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: surface, borderColor: border, borderWidth: 1, borderRadius: 12, minHeight: 74, padding: 14, marginTop: 9 }, selectedMethod: { backgroundColor: soft },
    paymentFootnote: { color: muted, fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 12 },
    success: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 8 }, successTitle: { color: ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 16 },
    ticket: { backgroundColor: surface, borderColor: separator, borderWidth: 1, borderRadius: 18, padding: 20, marginTop: 14 },
    ticketHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, ticketEyebrow: { color: muted, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 10, letterSpacing: 1 },
    ticketTitle: { color: ink, fontFamily: APP_FONTS.bold, fontWeight: "700", fontSize: 24, marginTop: 14 }, ticketPlate: { color: accent, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 21, letterSpacing: 1, marginTop: 6 },
    ticketCode: { alignItems: "center", justifyContent: "center", backgroundColor: soft, borderRadius: 12, padding: 18, gap: 10, marginVertical: 20 }, ticketId: { color: accent, fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 11, textAlign: "center" },
    detailRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 9, gap: 14, borderBottomColor: separator, borderBottomWidth: 1 }, detailLabel: { color: muted, fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13 }, detailValue: { color: ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 13, textAlign: "right", flexShrink: 1 },
    ticketWarning: { marginTop: 18 }, ticketWarningText: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 13, lineHeight: 19, color: muted, textAlign: "center" },
    empty: { alignItems: "center", paddingVertical: 40, gap: 10 }, emptyTitle: { color: ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 17 },
    historyItem: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomColor: separator, borderBottomWidth: 1, paddingVertical: 18 }, historyIcon: { backgroundColor: soft, borderRadius: 10, width: 42, height: 42, alignItems: "center", justifyContent: "center" }, historyAmount: { color: ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 13, flexShrink: 1 },
  });
}
