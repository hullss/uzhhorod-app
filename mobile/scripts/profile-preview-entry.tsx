/** Isolated visual QA of the real profile component. Synthetic data, no account/API calls. */
import { registerRootComponent } from "expo";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ProfileOverviewScreen } from "../src/components/ProfileOverviewScreen";
import { Alert, Text } from "../src/i18n/ui";
import { setLanguage } from "../src/i18n/locale";
import { addressKey } from "../src/power/model";
import { persistAddressBook } from "../src/storage/powerAddress";
import { themeTokens } from "../src/ui/themeTokens";

const options = new URLSearchParams(window.location.search);
const dark = options.get("theme") !== "light";
const long = options.has("long");
const guest = options.has("guest");
setLanguage(options.get("lang") === "en" ? "en" : "uk");
const address = { city: { id: 769, name: "Ужгород" }, street: { id: 1, name: long ? "вулиця Захисників Української Державності" : "вулиця Поштова" }, building: "12" };
const action = () => Alert.alert("QA", "Synthetic preview — no server operation.");
function Preview() {
  const [ready, setReady] = useState(false); const [failed, setFailed] = useState(false); const c = themeTokens(dark);
  useEffect(() => { void persistAddressBook({ defaultKey: addressKey(address), addresses: [address] }).then(() => setReady(true)).catch(() => setFailed(true)); }, []);
  const footer = <View style={{ backgroundColor: dark ? "#102d49" : "#ffffff", flexDirection: "row", paddingVertical: 12, borderTopWidth: 1, borderColor: c.border }}>
    {([['home-outline', 'Головна'], ['grid-outline', 'Сервіси'], ['notifications-outline', 'Стрічка'], ['person-outline', 'Профіль']] as const).map(([icon, label]) => <View key={label} style={{ flex: 1, alignItems: "center", gap: 4 }}><Ionicons name={icon} size={22} color={label === "Профіль" ? c.accent : c.muted} /><Text style={{ fontSize: 11, color: c.muted }}>{label}</Text></View>)}
  </View>;
  return <SafeAreaProvider>{failed ? <Text>QA storage unavailable</Text> : ready && <ProfileOverviewScreen dark={dark}
    name={guest ? "" : long ? "Олександра-Марія Баген-Захарченко" : "Вадим"}
    email={guest ? undefined : long ? "oleksandra.mariia@example.test" : "vadym@example.test"}
    card={null} ticketCount={guest ? 0 : 4} favoriteCount={guest ? 0 : 2} footer={footer}
    onPersonal={action} onSettings={action} onAccount={action} onAddresses={action} onCards={action}
    onTickets={action} onAppointments={action} onFavorites={action} onPower={action} onPolls={action} onHomeServices={action} />}</SafeAreaProvider>;
}
registerRootComponent(Preview);
