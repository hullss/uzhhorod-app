import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "../i18n/ui";
import { ScreenSafeArea, useScreenActive } from "../ui/Screen";
import { APP_FONTS } from "../ui/fonts";
import { addressKey, addressLabel } from "../power/model";
import { restoreAddressBook } from "../storage/powerAddress";
import { restoreAppointments } from "../storage/demoCivic";
import { isUpcoming } from "../civic/demoCivic";
import type { DemoPaymentCard } from "../storage/demoPaymentCard";
import { civicStyles, civicTheme } from "./CivicServiceUI";

type Props = {
  dark: boolean; name: string; email?: string; card: DemoPaymentCard | null;
  ticketCount: number; favoriteCount: number; footer: ReactNode;
  onPersonal: () => void; onSettings: () => void; onAccount: () => void;
  onAddresses: () => void; onCards: () => void; onTickets: () => void;
  onAppointments: () => void; onFavorites: () => void;
};
export function ProfileOverviewScreen(p: Props) {
  const s = civicStyles(p.dark); const c = civicTheme(p.dark); const active = useScreenActive();
  const [address, setAddress] = useState<string>(); const [appointments, setAppointments] = useState(0);
  const [addressError, setAddressError] = useState(false); const [appointmentError, setAppointmentError] = useState(false);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void restoreAddressBook().then(book => {
      if (!alive) return;
      const primary = book.addresses.find(item => addressKey(item) === book.defaultKey);
      setAddress(primary ? addressLabel(primary) : undefined); setAddressError(false);
    }).catch(() => { if (alive) { setAddress(undefined); setAddressError(true); } });
    void restoreAppointments().then(items => {
      if (alive) { setAppointments(items.filter(item => isUpcoming(item)).length); setAppointmentError(false); }
    }).catch(() => { if (alive) { setAppointments(0); setAppointmentError(true); } });
    return () => { alive = false; };
  }, [active]);
  const row = (icon: keyof typeof Ionicons.glyphMap, title: string, action: () => void, detail?: string, count = 0, raw = false) =>
    <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={action}
      style={{ minHeight: 58, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Ionicons name={icon} size={22} color={c.accent} />
      <View style={{ flex: 1, gap: 3 }}><Text style={s.body}>{title}</Text>{!!detail && <Text translate={!raw} style={s.muted}>{detail}</Text>}</View>
      {count > 0 && <Text translate={false} style={[s.muted, { fontVariant: ["tabular-nums"] }]}>{count}</Text>}
      <Ionicons name="chevron-forward" size={17} color={c.muted} />
    </Pressable>;
  const divider = <View style={{ height: 1, backgroundColor: c.border, marginLeft: 48 }} />;
  return <ScreenSafeArea bottomNavigation style={s.screen}>
    <ScrollView contentContainerStyle={[s.content, { gap: 24 }]} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text accessibilityRole="header" style={{ flex: 1, color: c.ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 24, lineHeight: 32 }}>Профіль</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Налаштування" style={s.iconButton} onPress={p.onSettings}><Ionicons name="settings-outline" size={24} color={c.accent} /></Pressable>
      </View>
      <View style={{ gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Особисті дані" onPress={p.onPersonal}
          style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Text translate={!p.name} style={[s.title, { flex: 1 }]}>{p.name || "Додати ім’я"}</Text>
          <Ionicons name="create-outline" size={21} color={c.muted} />
        </Pressable>
        {p.email ? <Text translate={false} selectable style={s.muted}>{p.email}</Text>
          : <Pressable accessibilityRole="button" accessibilityLabel="Увійти" onPress={p.onAccount}
              style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center", paddingRight: 18 }}><Text style={s.link}>Увійти</Text></Pressable>}
      </View>
      <View style={{ gap: 8 }}>
        <Text style={s.muted}>Мої дані</Text>
        <View style={[s.card, { padding: 0, gap: 0 }]}>
          {row("location-outline", "Мої адреси", p.onAddresses, addressError ? "Не вдалося прочитати адреси" : address, 0, !addressError)}
          {divider}
          {row("card-outline", "Картки", p.onCards, p.card ? `${p.card.label} · •••• ${p.card.last4}` : undefined, 0, true)}
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={s.muted}>Моє місто</Text>
        <View style={[s.card, { padding: 0, gap: 0 }]}>
          {row("ticket-outline", "Мої квитки", p.onTickets, undefined, p.ticketCount)}
          {divider}
          {row("calendar-outline", "Мої записи до ЦНАП", p.onAppointments, appointmentError ? "Не вдалося прочитати записи" : undefined, appointments)}
          {divider}
          {row("star-outline", "Обране", p.onFavorites, undefined, p.favoriteCount)}
        </View>
      </View>
    </ScrollView>
    {p.footer}
  </ScreenSafeArea>;
}
