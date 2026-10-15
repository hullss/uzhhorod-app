import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, Text } from "../i18n/ui";
import { ScreenSafeArea } from "../ui/Screen";
import { addressKey, addressLabel, type PowerAddress } from "../power/model";
import { persistAddressBook, restoreAddressBook, type AddressBook } from "../storage/powerAddress";
import { AddressPicker } from "./PowerOutagesScreen";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export function AddressesScreen({ dark, onBack }: { dark: boolean; onBack: () => void }) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  const [book, setBook] = useState<AddressBook>({ addresses: [], defaultKey: null });
  const [ready, setReady] = useState(false); const [error, setError] = useState("");
  const [editor, setEditor] = useState<PowerAddress | "new" | null>(null);
  const [saving, setSaving] = useState(false); const locked = useRef(false);
  const back = () => { if (locked.current) return; editor ? setEditor(null) : onBack(); };
  useHardwareBack(back); const swipe = useServiceSwipeBack(back);
  const load = () => { setError(""); void restoreAddressBook().then(b => { setBook(b); setReady(true); }).catch(() => setError("Не вдалося прочитати збережені адреси.")); };
  useEffect(load, []);
  async function save(next: AddressBook) {
    if (locked.current || !ready) return;
    locked.current = true; setSaving(true);
    try { await persistAddressBook(next); setBook(next); setEditor(null); }
    catch { Alert.alert("Адресу не збережено", "Не вдалося зберегти адресу на пристрої. Спробуйте ще раз."); }
    finally { locked.current = false; setSaving(false); }
  }
  const update = (a: PowerAddress) => {
    const oldKey = editor && editor !== "new" ? addressKey(editor) : null;
    const key = addressKey(a);
    const addresses = [...book.addresses.filter(item => addressKey(item) !== oldKey && addressKey(item) !== key), a];
    void save({ addresses, defaultKey: !book.defaultKey || book.defaultKey === oldKey ? key : book.defaultKey });
  };
  return <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title="Мої адреси" onBack={back} />
    <ScrollView contentContainerStyle={s.content}>
      {!ready && !error && <ActivityIndicator color={c.accent} />}
      {!!error && <><Text accessibilityRole="alert" style={s.body}>{error}</Text><PrimaryButton dark={dark} title="Спробувати ще раз" onPress={load} /></>}
      {ready && <>
        {book.addresses.map(a => <View key={addressKey(a)} style={s.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Ionicons name="location-outline" size={22} color={c.accent} /><Text translate={false} style={[s.body, { flex: 1 }]}>{addressLabel(a)}</Text></View>
          {book.defaultKey === addressKey(a) && <Text style={s.muted}>Основна адреса</Text>}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Pressable disabled={saving} accessibilityRole="button" style={s.iconButton} onPress={() => setEditor(a)}><Text style={s.link}>Редагувати</Text></Pressable>
            {book.defaultKey !== addressKey(a) && <Pressable disabled={saving} accessibilityRole="button" style={s.iconButton} onPress={() => void save({ ...book, defaultKey: addressKey(a) })}><Text style={s.link}>Зробити основною</Text></Pressable>}
            <Pressable disabled={saving} accessibilityRole="button" accessibilityLabel="Видалити адресу" style={s.iconButton} onPress={() => Alert.alert("Видалити адресу?", addressLabel(a), [{ text: "Скасувати", style: "cancel" }, { text: "Видалити", style: "destructive", onPress: () => { const addresses = book.addresses.filter(item => addressKey(item) !== addressKey(a)); void save({ addresses, defaultKey: book.defaultKey === addressKey(a) ? addresses[0] ? addressKey(addresses[0]) : null : book.defaultKey }); } }])}><Ionicons name="trash-outline" size={20} color={c.muted} /></Pressable>
          </View>
        </View>)}
        {!book.addresses.length && <Text style={s.muted}>Додайте домашню адресу або інше місце, яке часто використовуєте.</Text>}
        <PrimaryButton dark={dark} title="Додати адресу" disabled={saving || book.addresses.length >= 10} onPress={() => setEditor("new")} />
        <Text style={s.muted}>Адреси зберігаються на цьому пристрої. Основна адреса доступна міським сервісам; перевірка світла відкривається окремо.</Text>
      </>}
    </ScrollView>
    {editor && <AddressPicker dark={dark} initial={editor === "new" ? null : editor} saving={saving} onSave={update} onClose={() => { if (!saving) setEditor(null); }} />}
  </ScreenSafeArea>;
}
