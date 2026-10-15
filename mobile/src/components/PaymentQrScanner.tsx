import { Pressable, Text } from "../i18n/ui";
import { translate } from "../i18n/locale";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, View } from "react-native";
import { PAGE_LAYOUT } from "../ui/layout";
import { APP_FONTS } from "../ui/fonts";
import { useScreenActive } from "../ui/ScreenActivity";

export function PaymentQrScanner({ onScan, onClose, onManual }: {
  onScan: (payload: string) => void;
  onClose: () => void;
  onManual: () => void;
}) {
  const focused = useScreenActive();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(AppState.currentState === "active");
  const scanned = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
      if (state === "active") void getPermission().catch(() => setError("Не вдалося перевірити дозвіл камери."));
    });
    return () => subscription.remove();
  }, [getPermission]);

  return <View style={s.root}>
    {permission?.granted && !error && active && focused ? <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      autofocus="on"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      onMountError={() => setError("Камера недоступна. Спробуйте на телефоні або введіть номер автобуса.")}
      onBarcodeScanned={({ data }: { data: string }) => {
        if (scanned.current || !active || !focused) return;
        scanned.current = true;
        onScan(data);
      }}
    /> : null}
    <View style={s.header}>
      <Pressable accessibilityLabel="Закрити сканер" accessibilityRole="button" onPress={onClose} style={s.iconButton}><Ionicons name="close" size={25} color="#ffffff" /></Pressable>
      <Text style={s.title}>QR автобуса</Text>
      <Pressable accessibilityLabel={torch ? "Вимкнути ліхтарик" : "Увімкнути ліхтарик"} accessibilityRole="button" disabled={!permission?.granted || Boolean(error)} onPress={() => setTorch((value) => !value)} style={s.iconButton}><Ionicons name={torch ? "flash" : "flash-outline"} size={22} color="#ffffff" /></Pressable>
    </View>
    <ScrollView style={s.centerScroll} contentContainerStyle={s.center}>
      {!permission ? <ActivityIndicator color="#ffffff" /> : null}
      {permission?.granted && !error ? <>
        <View accessible accessibilityLabel={translate("Область сканування QR-коду")} style={s.frame}>
          <View style={[s.corner, s.topLeft]} /><View style={[s.corner, s.topRight]} />
          <View style={[s.corner, s.bottomLeft]} /><View style={[s.corner, s.bottomRight]} />
        </View>
        <Text style={s.hint}>Наведіть камеру на QR-код</Text>
        <Text style={s.caption}>У тестовому режимі реагує на будь-який QR</Text>
      </> : permission ? <View style={s.permission}>
        <Ionicons name="camera-outline" size={42} color="#ffffff" />
        <Text style={s.permissionTitle}>{error ? "Камера недоступна" : "Потрібен доступ до камери"}</Text>
        <Text style={s.permissionCopy}>{error ?? "Камера використовується лише для зчитування QR. Фото й відео не зберігаються."}</Text>
        {!error ? <Pressable accessibilityRole="button" style={s.permissionButton} onPress={() => {
          if (permission.canAskAgain) void requestPermission().catch(() => setError("Не вдалося відкрити запит дозволу камери."));
          else void Linking.openSettings().catch(() => setError("Відкрийте налаштування телефону й дозвольте доступ до камери."));
        }}><Text style={s.permissionButtonText}>{permission.canAskAgain ? "Дозволити камеру" : "Відкрити налаштування"}</Text></Pressable> : null}
        {error ? <Pressable accessibilityRole="button" style={s.permissionButton} onPress={() => {
          scanned.current = false; setTorch(false); setError(null);
          void getPermission().catch(() => setError("Не вдалося перевірити дозвіл камери. Введіть номер вручну."));
        }}><Text style={s.permissionButtonText}>Спробувати ще раз</Text></Pressable> : null}
      </View> : null}
    </ScrollView>
    <View style={s.footer}><Pressable accessibilityRole="button" style={s.manualButton} onPress={onManual}><Text style={s.manualText}>Ввести номер автомобіля</Text><Ionicons name="arrow-forward" size={18} color="#ffffff" /></Pressable></View>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#071b2f" },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10, backgroundColor: "rgba(7,27,47,0.7)" },
  iconButton: { alignItems: "center", justifyContent: "center", minWidth: 48, minHeight: 48 },
  title: { color: "#ffffff", fontSize: 18, fontFamily: APP_FONTS.semibold, fontWeight: "600", flex: 1, textAlign: "center" },
  centerScroll: { flex: 1 },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: PAGE_LAYOUT.gutter, paddingVertical: PAGE_LAYOUT.section },
  frame: { width: "100%", maxWidth: 244, aspectRatio: 1, position: "relative" },
  corner: { width: 36, height: 36, position: "absolute", borderColor: "#ffffff" },
  topLeft: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 12 },
  topRight: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 12 },
  hint: { color: "#ffffff", fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 16, textAlign: "center", marginTop: 28, backgroundColor: "rgba(7,27,47,0.85)", padding: 10, borderRadius: 10 },
  caption: { color: "#ffffff", fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 6, backgroundColor: "rgba(7,27,47,0.85)", padding: 8, borderRadius: 8 },
  permission: { alignItems: "center", gap: 16 },
  permissionTitle: { color: "#ffffff", fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 20, textAlign: "center" },
  permissionCopy: { color: "#b8cbe0", fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 14, lineHeight: 21, textAlign: "center" },
  permissionButton: { minHeight: 48, justifyContent: "center", backgroundColor: "#ffffff", borderRadius: 12, paddingHorizontal: PAGE_LAYOUT.gutter, paddingVertical: PAGE_LAYOUT.gap },
  permissionButtonText: { color: "#123a63", fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 14, textAlign: "center" },
  footer: { padding: 20, backgroundColor: "rgba(7,27,47,0.85)" },
  manualButton: { minHeight: 50, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  manualText: { color: "#ffffff", fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 14, flexShrink: 1, textAlign: "center" },
});
