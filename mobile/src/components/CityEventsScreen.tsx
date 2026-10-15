import { Pressable, Text } from "../i18n/ui";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Image, Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { ScreenSafeArea as SafeAreaView } from "../ui/Screen";
import { LocalScreenStack } from "../ui/ScreenStack";
import { getEditorialEvents } from "../api/cityServices";
import { availableEventCategories, eventDateLabel, isArchived, selectEvents, type CityEvent, type EventCatalog } from "../events/catalog";
import { VERIFIED_EVENTS } from "../events/verifiedEvents";
import { LatestRequest } from "../utils/latestRequest";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, ServiceSheet, ServiceTabs, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

function Poster({ event, dark, large = false }: { event: CityEvent; dark: boolean; large?: boolean }) {
  const [failed, setFailed] = useState(false); const c = civicTheme(dark);
  useEffect(() => setFailed(false), [event.posterUrl]);
  const frame = large ? { height: 260, width: "100%" as const } : { width: 82, height: 116 };
  return <View style={[frame, { backgroundColor: c.soft, borderRadius: 10, overflow: "hidden", justifyContent: "center", alignItems: "center" }]}>
    {event.posterUrl && !failed ? <Image accessibilityIgnoresInvertColors accessible={false} source={{ uri: event.posterUrl }} onError={() => setFailed(true)} resizeMode="contain" style={StyleSheet.absoluteFill} />
      : <Ionicons name="calendar-outline" size={large ? 52 : 30} color={c.accent} />}
  </View>;
}

export function CityEventsScreen({ dark, onBack }: { dark: boolean; onBack: () => void }) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  const [catalog, setCatalog] = useState<EventCatalog>({ items: VERIFIED_EVENTS, rejected: 0 });
  const [origin, setOrigin] = useState<"saved" | "server">("saved");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [linkError, setLinkError] = useState("");
  const [tab, setTab] = useState(0); const [category, setCategory] = useState("Усі");
  const [selected, setSelected] = useState<CityEvent | null>(null); const [info, setInfo] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const requests = useRef(new LatestRequest()); const list = useRef<ScrollView>(null);
  const back = useCallback(() => { if (info) setInfo(false); else if (selected) setSelected(null); else onBack(); }, [info, selected, onBack]);
  useHardwareBack(back); const swipe = useServiceSwipeBack(back);
  const refresh = useCallback(async () => {
    const id = requests.current.begin(); setBusy(true); setError("");
    try {
      const result = await getEditorialEvents();
      if (requests.current.isCurrent(id)) {
        setCatalog(result); setOrigin("server");
        setSelected(previous => previous ? result.items.find(item => item.id === previous.id) ?? null : null);
      }
    } catch {
      if (requests.current.isCurrent(id)) setError("Не вдалося оновити афішу. Спробуйте ще раз.");
    } finally { if (requests.current.isCurrent(id)) setBusy(false); }
  }, []);
  useEffect(() => { void refresh(); return () => requests.current.invalidate(); }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") { setNow(new Date()); void refresh(); } });
    return () => { clearInterval(timer); sub.remove(); };
  }, [refresh]);
  const open = async (url: string) => {
    setLinkError("");
    try { await Linking.openURL(url); } catch { setLinkError("Не вдалося відкрити посилання. Спробуйте ще раз."); }
  };
  const categories = availableEventCategories(catalog.items, tab === 1, now);
  // Resolve synchronously too: a refreshed catalogue or midnight must not render an empty
  // category frame while waiting for the state update.
  const activeCategory = categories.includes(category) ? category : "Усі";
  useEffect(() => { if (category !== activeCategory) setCategory(activeCategory); }, [category, activeCategory]);
  const visible = selectEvents(catalog.items, tab === 1, activeCategory, now);
  const archived = selected ? isArchived(selected, now) : false;
  const content = <SafeAreaView style={s.screen} {...swipe}>
    <StatusBar style={dark ? "light" : "dark"} />
    <View style={{ flex: 1 }} accessibilityElementsHidden={info} importantForAccessibility={info ? "no-hide-descendants" : "auto"} aria-hidden={info}>
      <ServiceHeader dark={dark} title={selected ? "Подія" : "Події міста"} onBack={back} onInfo={() => setInfo(true)} />
      {!selected && <View style={{ flex: 1 }}>
        <ServiceTabs dark={dark} labels={["Майбутні", "Архів"]} selected={tab} onChange={index => { setTab(index); list.current?.scrollTo({ y: 0, animated: false }); }} />
        <ScrollView ref={list} contentContainerStyle={[s.content, { paddingTop: 0, gap: 16 }]} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void refresh()} tintColor={c.accent} />}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
            {categories.map(label => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: label === activeCategory }} onPress={() => setCategory(label)} style={{ minHeight: 44, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22, backgroundColor: activeCategory === label ? c.button : c.surface, borderWidth: 1, borderColor: c.border }}>
              <Text style={[s.body, { color: activeCategory === label ? "#ffffff" : c.ink }]}>{label}</Text>
            </Pressable>)}
          </ScrollView>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Text style={[s.muted, { flex: 1 }]}>{origin === "saved" ? "Збережена добірка · 08.10.2026" : "Афіша міста"}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Оновити афішу" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => void refresh()} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
              {busy ? <ActivityIndicator color={c.accent} /> : <Ionicons name="refresh" size={23} color={c.accent} />}
            </Pressable>
          </View>
          {!!error && <Text accessibilityRole="alert" style={s.muted}>{error} {catalog.items.length > 0 ? "Показуємо останню доступну добірку." : ""}</Text>}
          {catalog.rejected > 0 && <Text style={s.muted}>Частина записів потребує перевірки дат. Показуємо лише події з повною інформацією.</Text>}
          {visible.length === 0 ? <View style={s.empty}><Ionicons name="calendar-outline" size={48} color={c.accent} /><Text style={[s.title, { textAlign: "center" }]}>{category !== "Усі" ? "У цій категорії поки немає подій" : tab === 0 ? "Нові події зʼявляться тут" : "Архів поки порожній"}</Text><Text style={[s.muted, { textAlign: "center" }]}> {category !== "Усі" ? "Оберіть іншу категорію або оновіть афішу." : "Оновіть афішу пізніше."}</Text></View>
            : visible.map((event, index) => <View key={event.id} style={{ gap: 12 }}>
              {(index === 0 || visible[index - 1].date !== event.date) && <Text accessibilityRole="header" style={s.link}>{eventDateLabel(event.date)}</Text>}
              <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${eventDateLabel(event.date)}, ${event.time ?? "час уточнюється"}, ${event.venue}. Деталі події`} onPress={() => { setLinkError(""); setSelected(event); }} style={[s.card, { padding: 14, flexDirection: "row", alignItems: "center", gap: 14 }]}>
                <Poster event={event} dark={dark} />
                <View style={{ flex: 1, gap: 6 }}><Text style={s.muted}>{event.category}{event.time ? ` · ${event.time}` : ""}</Text><Text translate={false} style={[s.body, { fontWeight: "600" }]}>{event.title}</Text><Text translate={false} style={s.muted}>{event.venue}</Text></View>
              </Pressable>
            </View>)}
        </ScrollView>
      </View>}
      {selected && <>
        <ScrollView key={selected.id} contentContainerStyle={s.content}>
          {!!selected.posterUrl && <Poster event={selected} dark={dark} large />}
          <View style={{ gap: 8 }}><Text style={s.muted}>{selected.category}{archived ? " · Архів" : ""}</Text><Text translate={false} accessibilityRole="header" style={s.title}>{selected.title}</Text><Text style={s.link}>{eventDateLabel(selected.date)} · {selected.time ?? "Час уточнюється"}</Text></View>
          <View style={{ gap: 6 }}><Text translate={false} style={[s.body, { fontWeight: "600" }]}>{selected.venue}</Text>
            {!!selected.address && <Pressable accessibilityRole="link" accessibilityLabel={`Адреса на мапі: ${selected.address}`} onPress={() => void open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.address!)}`)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={s.link}>{selected.address} ↗</Text></Pressable>}
          </View>
          <Text translate={false} style={s.body}>{selected.description}</Text>
          {!!selected.organizer && <Text style={s.muted}>Організатор: {selected.organizer}</Text>}
          <Text style={s.muted}>Інформацію перевірено {eventDateLabel(selected.verifiedAt)}. Перед відвідуванням звірте можливі зміни на сторінці події.</Text>
          {!!linkError && <Text accessibilityRole="alert" style={s.muted}>{linkError}</Text>}
        </ScrollView>
        <View style={s.footer}><PrimaryButton dark={dark} title="Сторінка події ↗" onPress={() => void open(selected.sourceUrl)} /><Text style={[s.muted, { textAlign: "center" }]}>Деталі, реєстрація або квитки — на сайті організатора</Text></View>
      </>}
    </View>
    <ServiceSheet dark={dark} visible={info} onClose={() => setInfo(false)}><Text accessibilityRole="header" style={s.title}>Про події міста</Text><Text style={s.body}>Виставки, лекції, майстер-класи, спорт, сімейні події та концерти. Дати й місця перевіряємо за джерелом організатора.</Text><Text style={s.body}>Реєстрація й квитки — на сторінці події. Минулі дати переходять до архіву наступного дня за часом Києва.</Text><PrimaryButton dark={dark} title="Зрозуміло" onPress={() => setInfo(false)} /></ServiceSheet>
  </SafeAreaView>;
  return <LocalScreenStack path={selected ? ["events", `event:${selected.id}`] : ["events"]} backgroundColor={c.bg}>{content}</LocalScreenStack>;
}
