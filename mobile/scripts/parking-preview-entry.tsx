/** Isolated parking QA: no backend/bank requests, separate loopback storage origin. */
import { useState } from "react";
import { registerRootComponent } from "expo";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ParkingDemoScreen } from "../src/components/ParkingDemoScreen";
import { setLanguage } from "../src/i18n/locale";
function Preview() {
  const [dark, setDark] = useState(false); const [open, setOpen] = useState(true);
  return <SafeAreaProvider><View style={{ flex: 1, alignItems: "center", backgroundColor: "#dce3ea" }}>
    <View style={{ width: "100%", maxWidth: 390, height: "100%", maxHeight: 844 }}>
      <View style={{ flexDirection: "row", backgroundColor: "#fff", padding: 6, gap: 8 }}>
        {[{ label: "Light / Dark", action: () => setDark(value => !value) }, { label: "UK", action: () => setLanguage("uk") }, { label: "EN", action: () => setLanguage("en") }, { label: "Reopen", action: () => setOpen(value => !value) }].map(item => <Pressable key={item.label} onPress={item.action} style={{ minHeight: 36, justifyContent: "center" }}><Text>{item.label}</Text></Pressable>)}
      </View>
      {open && <ParkingDemoScreen dark={dark} card={{ label: "Макет картки", last4: "1111" }} onBack={() => setOpen(false)} />}
    </View>
  </View></SafeAreaProvider>;
}
registerRootComponent(Preview);
