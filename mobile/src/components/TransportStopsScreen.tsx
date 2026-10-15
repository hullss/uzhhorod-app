import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, TextInput } from "../i18n/ui";
import { getDepartures, getStopRoutes, type TransportRoute, type TransportStop } from "../api/transport";
import { cityDate, citySeconds } from "../utils/cityTime";
import { ScreenSafeArea } from "../ui/Screen";
import { OfficialLayerMap } from "./OfficialLayerMap";
import { TransportCacheNotice } from "./TransportCacheNotice";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, ServiceSheet, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export type StopArrival = { route: TransportRoute; destination: string; time: string; seconds: number };
export function upcomingStopArrivals(items: StopArrival[], seconds: number) {
  return items.filter(a => a.seconds >= seconds).sort((a, b) => a.seconds - b.seconds || a.route.routeNumber.localeCompare(b.route.routeNumber, "uk", { numeric: true })).slice(0, 5);
}
export function TransportStopsScreen({ dark, stops, loading, onBack, onOpenRoute }: {
  dark: boolean; stops: TransportStop[]; loading: boolean; onBack: () => void; onOpenRoute: (r: TransportRoute) => void;
}) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState<TransportStop | null>(null);
  const [arrivals, setArrivals] = useState<StopArrival[]>([]); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(""); const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(new Date()); const [listOpen, setListOpen] = useState(false);
  const back = () => selected ? setSelected(null) : listOpen ? setListOpen(false) : onBack();
  useHardwareBack(back); const swipe = useServiceSwipeBack(back);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(timer); }, []);
  const date = cityDate(now);
  useEffect(() => {
    if (!selected) return;
    let alive = true; setBusy(true); setError(""); setArrivals([]);
    void (async () => {
      try {
        const routes = await getStopRoutes(selected.id);
        const collected: StopArrival[] = []; let index = 0; let failed = false;
        // Limit concurrent schedule requests, but inspect every route at this stop.
        await Promise.all(Array.from({ length: Math.min(4, routes.length) }, async () => {
          while (index < routes.length && alive) {
            const route = routes[index++];
            try { const departures = await getDepartures(route.id, selected.id, date);
              collected.push(...departures.map(d => ({ route, destination: d.destination, time: d.departureTime, seconds: d.departureTimeSeconds })));
            } catch { failed = true; }
          }
        }));
        if (alive) { setArrivals(collected); if (failed) setError("Не всі розклади вдалося завантажити. Спробуйте ще раз."); }
      } catch { if (alive) setError("Не вдалося завантажити розклад зупинки."); }
      finally { if (alive) setBusy(false); }
    })();
    return () => { alive = false; };
  }, [selected?.id, date, retry]);
  const filtered = stops.filter(stop => stop.name.toLocaleLowerCase("uk").includes(query.trim().toLocaleLowerCase("uk")));
  const upcoming = upcomingStopArrivals(arrivals, citySeconds(now));
  return <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title="Зупинки" onBack={onBack} />
    <View style={{ paddingHorizontal: 20 }}><TransportCacheNotice value={stops} /></View>
    <View style={{ padding: 16, gap: 8 }}><View style={{ flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 10, paddingHorizontal: 12 }}><Ionicons name="search-outline" size={20} color={c.muted} /><TextInput accessibilityLabel="Назва зупинки" placeholder="Назва зупинки" placeholderTextColor={c.muted} value={query} onChangeText={setQuery} style={{ flex: 1, color: c.ink, minHeight: 48, paddingHorizontal: 10, fontSize: 15 }} /><Pressable accessibilityRole="button" accessibilityLabel="Показати список зупинок" style={s.iconButton} onPress={() => setListOpen(true)}><Ionicons name="list-outline" size={22} color={c.accent} /></Pressable></View>
      {loading && <ActivityIndicator color={c.accent} />}
      {!!query && <Pressable accessibilityRole="button" style={s.iconButton} onPress={() => setListOpen(true)}><Text style={s.link}>Результати пошуку: {filtered.length}</Text></Pressable>}
    </View>
    <View style={{ flex: 1 }}><OfficialLayerMap points={filtered.filter(stop => Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)).map(stop => ({ ...stop, name: stop.name.replace(/\s*\(\d+\)$/, ""), address: "" }))} pinColor={dark ? "#8fc8ff" : "#123a63"} onPointPress={point => { setSelected(stops.find(stop => stop.id === point.id) ?? null); setQuery(""); }} /></View>
    {!loading && !stops.length && <Text style={[s.muted, { padding: 16 }]}>Зупинки зараз недоступні.</Text>}
    <ServiceSheet dark={dark} visible={listOpen} onClose={() => setListOpen(false)}>
      <Text style={s.title}>Зупинки</Text>{filtered.map(stop => <Pressable key={stop.id} accessibilityRole="button" onPress={() => { setListOpen(false); setSelected(stop); }} style={[s.row, s.divider]}><Text translate={false} style={s.rowText}>{stop.name.replace(/\s*\(\d+\)$/, "")}</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>)}
      {!filtered.length && <Text style={s.muted}>Зупинок не знайдено.</Text>}
    </ServiceSheet>
    <ServiceSheet dark={dark} visible={!!selected} onClose={() => setSelected(null)}>
      <Text translate={false} style={s.title}>{selected?.name.replace(/\s*\(\d+\)$/, "")}</Text><Text style={s.muted}>Найближчі відправлення · за розкладом, не GPS</Text>
      {busy ? <ActivityIndicator color={c.accent} /> : <>
        {upcoming.map((a, i) => <Pressable key={`${a.route.id}:${a.time}:${i}`} accessibilityRole="button" onPress={() => onOpenRoute(a.route)} style={[s.row, s.divider, { paddingHorizontal: 0 }]}><View style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: c.button }}><Text style={[s.link, { color: "#fff" }]}>{a.route.routeNumber}</Text></View><View style={{ flex: 1 }}><Text translate={false} style={s.body}>{a.destination}</Text><Text style={s.muted}>Через {Math.max(0, Math.ceil((a.seconds - citySeconds(now)) / 60))} хв</Text></View><Text style={s.link}>{a.time.slice(0, 5)}</Text></Pressable>)}
        {!upcoming.length && !error && <Text style={s.muted}>На сьогодні найближчих відправлень немає.</Text>}
      </>}
      {!!error && <><Text accessibilityRole="alert" style={s.muted}>{error}</Text><PrimaryButton dark={dark} title="Спробувати ще раз" onPress={() => setRetry(v => v + 1)} /></>}
    </ServiceSheet>
  </ScreenSafeArea>;
}
