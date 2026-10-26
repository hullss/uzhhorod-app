import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "../i18n/ui";
import { ScreenSafeArea, useScreenActive } from "../ui/Screen";
import { APP_FONTS } from "../ui/fonts";
import { addressKey, addressLabel } from "../power/model";
import { restoreAddressBook } from "../storage/powerAddress";
import { restoreAppointments } from "../storage/demoCivic";
import { dateLabel, isUpcoming } from "../civic/demoCivic";
import type { DemoPaymentCard } from "../storage/demoPaymentCard";
import { civicStyles, civicTheme } from "./CivicServiceUI";

type Props = {
  dark: boolean; name: string; email?: string; card: DemoPaymentCard | null;
  ticketCount: number; favoriteCount: number; footer: ReactNode;
  onPersonal: () => void; onSettings: () => void; onAccount: () => void;
  onAddresses: () => void; onCards: () => void; onTickets: () => void;
  onAppointments: () => void; onFavorites: () => void;
  onPower: () => void; onPolls: () => void; onHomeServices: () => void;
};
export function ProfileOverviewScreen(p: Props) {
  const s = civicStyles(p.dark); const c = civicTheme(p.dark); const active = useScreenActive();
  const ui = profileOverviewStyles(p.dark);
  const [address, setAddress] = useState<string>(); const [appointments, setAppointments] = useState(0);
  const [nextVisit, setNextVisit] = useState<string>();
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
      if (alive) {
        const upcoming = items.filter(item => isUpcoming(item)).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
        setAppointments(upcoming.length);
        setNextVisit(upcoming[0] ? `${dateLabel(upcoming[0].date)} · ${upcoming[0].time}` : undefined);
        setAppointmentError(false);
      }
    }).catch(() => { if (alive) { setAppointments(0); setNextVisit(undefined); setAppointmentError(true); } });
    return () => { alive = false; };
  }, [active]);
  const row = (icon: keyof typeof Ionicons.glyphMap, title: string, action: () => void, detail?: string, count = 0, raw = false) =>
    <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} accessibilityHint={detail}
      accessibilityValue={count > 0 ? { text: String(count) } : undefined} onPress={action}
      style={ui.row}>
      <Ionicons name={icon} size={21} color={c.muted} />
      <View style={ui.rowCopy}><Text style={ui.rowTitle}>{title}</Text>{!!detail && <Text translate={!raw} style={ui.detail}>{detail}</Text>}</View>
      {count > 0 && <View style={ui.count}><Text translate={false} style={ui.countText}>{count}</Text></View>}
      <Ionicons name="chevron-forward" size={16} color={c.muted} />
    </Pressable>;
  const divider = <View style={ui.divider} />;
  return <ScreenSafeArea bottomNavigation style={s.screen}>
    <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
      <View style={ui.identity}>
        <View style={ui.identityTop}>
          <Text style={ui.eyebrow}>Профіль</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Налаштування" style={ui.settings} onPress={p.onSettings}><Ionicons name="settings-outline" size={23} color={c.ink} /></Pressable>
        </View>
        <View style={ui.nameRow}>
          <Text translate={!p.name} accessibilityRole="header" style={ui.name}>{p.name || "Додати ім’я"}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Особисті дані" onPress={p.onPersonal} style={ui.edit}>
            <Ionicons name="pencil-outline" size={18} color={c.muted} />
          </Pressable>
        </View>
        {p.email ? <Text translate={false} selectable style={ui.email}>{p.email}</Text>
          : <Pressable accessibilityRole="button" accessibilityLabel="Увійти" onPress={p.onAccount}
              style={ui.signIn}><Text style={s.link}>Увійти</Text></Pressable>}
      </View>
      <View style={ui.quickPanel}>
        <View style={ui.quickHeading}><View style={ui.cityIcon}><Ionicons name="location-outline" size={20} color={c.accent} /></View><View style={{ flex: 1 }}><Text style={ui.panelTitle}>Мій Ужгород</Text><Text style={ui.detail}>Ваші щоденні справи — поруч</Text></View></View>
        <View style={ui.quickGrid}>
          {([
            ["flash-outline", "Світло за адресою", p.onPower],
            ["grid-outline", "Мої сервіси", p.onHomeServices],
            ["checkbox-outline", "Опитування", p.onPolls],
          ] as const).map(([icon, title, onPress]) => <Pressable key={title} accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={ui.quickAction}>
            <Ionicons name={icon} size={22} color={c.accent} /><Text style={ui.quickText}>{title}</Text>
          </Pressable>)}
        </View>
      </View>
      {nextVisit && <Pressable accessibilityRole="button" accessibilityLabel="Найближчий запис до ЦНАП" onPress={p.onAppointments} style={ui.nextVisit}>
        <Ionicons name="calendar-outline" size={24} color={c.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={ui.rowTitle}>Найближчий запис до ЦНАП</Text><Text translate={false} style={ui.detail}>{nextVisit}</Text><Text style={ui.detail}>Тестовий запис · до ЦНАП не передається</Text></View><Ionicons name="chevron-forward" size={16} color={c.muted} />
      </Pressable>}
      <View style={ui.group}>
          {row("location-outline", "Адреси", p.onAddresses, addressError ? "Не вдалося прочитати адреси" : address ?? "Додайте дім або роботу", 0, !!address && !addressError)}
          {divider}
          {row("card-outline", "Способи оплати", p.onCards, p.card ? `${p.card.label} · •••• ${p.card.last4}` : "Картка для тестових оплат", 0, !!p.card)}
      </View>
      <View style={ui.saved}>
        <Text accessibilityRole="header" style={ui.sectionTitle}>Збережене</Text>
        <View style={ui.group}>
          {row("ticket-outline", "Квитки", p.onTickets, undefined, p.ticketCount)}
          {divider}
          {row("calendar-outline", "Записи до ЦНАП", p.onAppointments, appointmentError ? "Не вдалося прочитати записи" : undefined, appointments)}
          {divider}
          {row("star-outline", "Обране", p.onFavorites, undefined, p.favoriteCount)}
        </View>
      </View>
    </ScrollView>
    {p.footer}
  </ScreenSafeArea>;
}

export function profileOverviewStyles(dark: boolean) {
  const c = civicTheme(dark);
  return StyleSheet.create({
    content: { flexGrow: 1, width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32, gap: 20 },
    identity: { paddingBottom: 2 },
    identityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    eyebrow: { color: c.muted, fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 15, lineHeight: 22 },
    settings: { minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    name: { color: c.ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 28, lineHeight: 36, letterSpacing: -0.5, flexShrink: 1 },
    edit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    email: { color: c.muted, fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 21, marginTop: 2 },
    signIn: { alignSelf: "flex-start", minHeight: 44, paddingRight: 18, justifyContent: "center" },
    quickPanel: { backgroundColor: dark ? "#102f49" : c.soft, borderRadius: 20, padding: 16, gap: 16 },
    quickHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
    cityIcon: { backgroundColor: c.surface, width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    panelTitle: { color: c.ink, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 18, lineHeight: 26 },
    quickGrid: { flexDirection: "row", gap: 8 },
    quickAction: { flex: 1, minHeight: 88, padding: 8, borderRadius: 12, backgroundColor: c.surface, gap: 8 },
    quickText: { color: c.ink, fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 12, lineHeight: 17 },
    nextVisit: { borderColor: c.border, borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface },
    group: { backgroundColor: dark ? "#0c2339" : c.surface, borderRadius: 16, overflow: "hidden" },
    row: { minHeight: 64, paddingHorizontal: 16, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 },
    rowCopy: { flex: 1, gap: 4 },
    rowTitle: { color: c.ink, fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 16, lineHeight: 23 },
    detail: { color: c.muted, fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 20 },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: 49, marginRight: 16 },
    saved: { gap: 10 },
    sectionTitle: { color: c.muted, fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 13, lineHeight: 20, paddingLeft: 2 },
    count: { minWidth: 26, minHeight: 26, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "#15334e" : c.soft, flexShrink: 0 },
    countText: { color: c.ink, fontFamily: APP_FONTS.medium, fontWeight: "500", fontSize: 12, lineHeight: 18, fontVariant: ["tabular-nums"] },
  });
}
