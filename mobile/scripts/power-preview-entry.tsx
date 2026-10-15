/** Isolated UI QA: fixture responses only, no bank, account or provider requests. Not imported by App. */
import { registerRootComponent } from "expo";
import { useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View, Pressable, Text } from "react-native";
import { PowerOutagesScreen } from "../src/components/PowerOutagesScreen";
import { setLanguage } from "../src/i18n/locale";
const originalFetch = globalThis.fetch;
let mode = "normal";
globalThis.fetch = (input, options) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/api/city-services/power/") ? originalFetch(`http://localhost:8092${new URL(url).pathname}${new URL(url).search}${url.includes("?") ? "&" : "?"}mode=${mode}`, options) : originalFetch(input, options);
};
function Preview() {
  const [dark, setDark] = useState(false); const [english, setEnglish] = useState(false);
  return <SafeAreaProvider><View style={{ flex: 1 }}>
    <View style={{ padding: 8, gap: 8, flexDirection: "row", flexWrap: "wrap", backgroundColor: "#e2e8f0" }}>
      <Pressable accessibilityRole="button" onPress={() => setDark(!dark)}><Text>QA theme</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { setLanguage(english ? "uk" : "en"); setEnglish(!english); }}><Text>QA language</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { mode = "stale"; }}><Text>QA stale</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => { mode = "error"; }}><Text>QA error</Text></Pressable>
    </View>
    <PowerOutagesScreen isDarkTheme={dark} onBack={() => {}} />
  </View></SafeAreaProvider>;
}
registerRootComponent(Preview);
