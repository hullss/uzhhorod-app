import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, Text } from "../i18n/ui";
import { ScreenSafeArea } from "../ui/Screen";
import { ECO_ISLANDS, ECO_SOURCE, ECO_MAP_SOURCE, type EcoIsland } from "../maps/ecoIslands";
import { OfficialLayerMap } from "./OfficialLayerMap";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, ServiceSheet, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export function WasteScreen({ dark, onBack }: { dark: boolean; onBack: () => void }) {
  const s = civicStyles(dark); const c = civicTheme(dark); const [selected, setSelected] = useState<EcoIsland | null>(null);
  const back = () => selected ? setSelected(null) : onBack(); const swipe = useServiceSwipeBack(back); useHardwareBack(back);
  const open = async (url: string) => { try { await Linking.openURL(url); } catch { Alert.alert("Не вдалося відкрити сайт", "Спробуйте ще раз пізніше."); } };
  const points = ECO_ISLANDS.flatMap(p => p.latitude !== undefined && p.longitude !== undefined ? [{ id: p.id, name: "Екоострівець АВЕ", address: p.address, latitude: p.latitude, longitude: p.longitude }] : []);
  return <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title="Сортування відходів" onBack={back} />
    <ScrollView contentContainerStyle={s.content}>
      <View style={{ height: 280, borderRadius: 12, overflow: "hidden", borderColor: c.border, borderWidth: 1 }}><OfficialLayerMap points={points} pinColor="#3d6836" onPointPress={p => setSelected(ECO_ISLANDS.find(e => e.id === p.id) ?? null)} /></View>
      <Text style={s.muted}>{`${points.length} на мапі · ${ECO_ISLANDS.length} адрес у списку`}</Text>
      <Text style={s.muted}>АВЕ публікує координати лише для частини адрес. Для інших доступний пошук адреси на зовнішній мапі.</Text>
      <Text style={s.title}>Екоострівці АВЕ</Text>
      <View style={[s.card, { padding: 0 }]}>{ECO_ISLANDS.map((p, i) => <Pressable key={p.id} accessibilityRole="button" onPress={() => setSelected(p)} style={[s.row, i < ECO_ISLANDS.length - 1 && s.divider]}><Ionicons name="leaf-outline" size={22} color={c.accent} /><View style={{ flex: 1 }}><Text translate={false} style={s.body}>{p.address}</Text><Text style={s.muted}>{p.latitude !== undefined ? "Є позначка на мапі" : "Координати ще не уточнені"}</Text>{p.reuse && <Text style={s.muted}>Є реюз-центр</Text>}</View><Ionicons name="chevron-forward" size={18} color={c.muted} /></Pressable>)}</View>
      <Pressable accessibilityRole="link" style={s.iconButton} onPress={() => void open(ECO_MAP_SOURCE)}><Text style={s.link}>Офіційна мапа АВЕ ↗</Text></Pressable>
      <Pressable accessibilityRole="link" style={s.iconButton} onPress={() => void open(ECO_SOURCE)}><Text style={s.link}>Інформація АВЕ ↗</Text></Pressable>
    </ScrollView>
    <ServiceSheet dark={dark} visible={!!selected} onClose={() => setSelected(null)}>
      <Text style={s.title}>Екоострівець АВЕ</Text><Text translate={false} style={s.body}>{selected?.address}</Text>
      <Text style={s.body}>Папір, картон, пластик, скло, алюмінієві банки та батарейки.</Text>
      <Text style={s.muted}>Пн–Сб: 08:00–10:00, 13:00–19:00. Неділя — вихідний. Перед поїздкою уточніть графік в АВЕ.</Text>
      {selected?.reuse && <Text style={s.muted}>Реюз-центр приймає справні речі для повторного використання. Одяг, взуття, продукти та меблі не приймають.</Text>}
      {selected && <PrimaryButton dark={dark} title={selected.latitude ? "Прокласти маршрут" : "Знайти адресу на мапі"} onPress={() => void open(selected.latitude && selected.longitude ? `https://www.google.com/maps/dir/?api=1&destination=${selected.latitude},${selected.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Ужгород ${selected.address}`)}`)} />}
      <Pressable accessibilityRole="link" style={s.iconButton} onPress={() => void open("tel:+380504347700")}><Text style={s.link}>Зателефонувати АВЕ</Text></Pressable>
    </ServiceSheet>
  </ScreenSafeArea>;
}
