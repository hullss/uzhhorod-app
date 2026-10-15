import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "../i18n/ui";
import { ScreenSafeArea, useScreenActive } from "../ui/Screen";
import { getRoutes, getStops, type TransportRoute, type TransportStop } from "../api/transport";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export function FavoritesScreen({ dark, signedIn, routeIds, stopIds, onBack, onSignIn, onRoute, onStop }: {
  dark: boolean; signedIn: boolean; routeIds: string[]; stopIds: string[];
  onBack: () => void; onSignIn: () => void; onRoute: (route: TransportRoute) => void; onStop: (stop: TransportStop) => void;
}) {
  const s = civicStyles(dark); const c = civicTheme(dark); const active = useScreenActive();
  useHardwareBack(onBack); const swipe = useServiceSwipeBack(onBack);
  const [routes, setRoutes] = useState<TransportRoute[]>([]); const [stops, setStops] = useState<TransportStop[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false); const [retry, setRetry] = useState(0);
  const routeKey = JSON.stringify(routeIds), stopKey = JSON.stringify(stopIds);
  useEffect(() => {
    if (!active || !signedIn || (!routeIds.length && !stopIds.length)) return;
    let alive = true; setBusy(true); setError(false);
    void Promise.allSettled([routeIds.length ? getRoutes() : Promise.resolve([]), stopIds.length ? getStops() : Promise.resolve([])]).then(([r, t]) => {
      if (!alive) return;
      if (r.status === "fulfilled") setRoutes(r.value);
      if (t.status === "fulfilled") setStops(t.value);
      setError(r.status === "rejected" || t.status === "rejected"); setBusy(false);
    });
    return () => { alive = false; };
  }, [active, signedIn, routeKey, stopKey, retry]);
  const savedRoutes = routes.filter(route => routeIds.includes(route.id));
  const savedStops = stops.filter(stop => stopIds.includes(stop.id));
  const missing = savedRoutes.length !== routeIds.length || savedStops.length !== stopIds.length;
  const item = (key: string, title: string, action: () => void, number?: string) => <Pressable key={key} accessibilityRole="button" accessibilityLabel={title} onPress={action} style={[s.row, s.divider]}>
    {number ? <View style={{ minWidth: 44, minHeight: 44, borderRadius: 8, backgroundColor: c.button, alignItems: "center", justifyContent: "center", paddingHorizontal: 7 }}><Text translate={false} style={[s.body, { color: "#fff", fontWeight: "600" }]}>{number}</Text></View> : <Ionicons name="location-outline" size={22} color={c.accent} />}
    <Text translate={false} style={[s.body, { flex: 1 }]}>{title}</Text><Ionicons name="chevron-forward" size={18} color={c.muted} />
  </Pressable>;
  return <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title="Обране" onBack={onBack} />
    <ScrollView contentContainerStyle={s.content}>
      {!signedIn ? <View style={{ gap: 12 }}><Text style={s.body}>Увійдіть, щоб зберігати маршрути та зупинки.</Text><PrimaryButton dark={dark} title="Увійти" onPress={onSignIn} /></View>
        : !routeIds.length && !stopIds.length ? <Text style={s.muted}>Тут з’являться маршрути та зупинки, які ви позначите зірочкою.</Text>
        : <>
          {busy && <ActivityIndicator color={c.accent} accessibilityLabel="Завантажуємо обране" />}
          {!!savedRoutes.length && <><Text style={s.muted}>Маршрути</Text><View style={[s.card, { padding: 0, gap: 0 }]}>{savedRoutes.map(route => item(`route:${route.id}`, route.name, () => onRoute(route), route.routeNumber))}</View></>}
          {!!savedStops.length && <><Text style={s.muted}>Зупинки</Text><View style={[s.card, { padding: 0, gap: 0 }]}>{savedStops.map(stop => item(`stop:${stop.id}`, stop.name, () => onStop(stop)))}</View></>}
          {!busy && (error || missing) && <><Text style={s.muted}>Частина обраного поки недоступна. Збережені записи не видалено.</Text><PrimaryButton dark={dark} title="Спробувати ще раз" onPress={() => setRetry(value => value + 1)} /></>}
        </>}
    </ScrollView>
  </ScreenSafeArea>;
}
