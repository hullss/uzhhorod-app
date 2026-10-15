import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, ScrollView, StyleSheet, View } from "react-native";
import { ScreenSafeArea as SafeAreaView } from "../ui/Screen";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { Alert, Pressable, Text, TextInput } from "../i18n/ui";
import { getLocale } from "../i18n/locale";
import { getPowerCities, getPowerStatus, getPowerStreets } from "../api/power";
import { addressKey, addressLabel, decodeAddress, outagePeriod, powerStatusMessage, POWER_SOURCE, type PowerAddress, type PowerPlace, type PowerStatus } from "../power/model";
import { persistPowerAddress, restorePowerAddress } from "../storage/powerAddress";
import { ChoiceRow, civicStyles, civicTheme, PrimaryButton, ServiceHeader, ServiceSheet, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

type Props = { isDarkTheme: boolean; onBack: () => void; profile?: boolean };
export function PowerOutagesScreen({ isDarkTheme: dark, onBack, profile = false }: Props) {
  const s = civicStyles(dark); const c = civicTheme(dark); const swipe = useServiceSwipeBack(onBack);
  useHardwareBack(onBack);
  const [address, setAddress] = useState<PowerAddress | null>(null);
  const [restored, setRestored] = useState(false);
  const [editing, setEditing] = useState(false);
  const [info, setInfo] = useState(false);
  const [status, setStatus] = useState<PowerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now);
  const revision = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    const sub = AppState.addEventListener("change", state => { if (state === "active") setNow(Date.now()); });
    return () => { clearInterval(timer); sub.remove(); };
  }, []);
  useEffect(() => {
    let alive = true;
    restorePowerAddress().then(a => { if (alive) setAddress(a); }).catch(() => { if (alive) setError("Не вдалося прочитати збережену адресу."); }).finally(() => { if (alive) setRestored(true); });
    return () => { alive = false; revision.current++; };
  }, []);
  const key = address ? addressKey(address) : "";
  useEffect(() => {
    if (!address || !restored || editing) return;
    let active = true; let busy = false;
    const load = async () => {
      if (busy || AppState.currentState === "background" || AppState.currentState === "inactive") return;
      busy = true;
      const version = revision.current;
      setLoading(true); setError(null);
      try { const next = await getPowerStatus(address); if (active && version === revision.current) setStatus(next); }
      catch (e) { if (active && version === revision.current) setError(e instanceof Error ? e.message : "Не вдалося перевірити відключення."); }
      finally { busy = false; if (active && version === revision.current) setLoading(false); }
    };
    void load();
    const timer = setInterval(() => void load(), 5 * 60_000);
    const listener = AppState.addEventListener("change", state => { if (state === "active") void load(); });
    return () => { active = false; clearInterval(timer); listener.remove(); };
  }, [key, restored, editing, refresh]);
  const save = async (next: PowerAddress | null) => {
    setSaving(true);
    try { await persistPowerAddress(next); revision.current++; setStatus(null); setError(null); setAddress(next); setEditing(false); }
    catch { Alert.alert("Адресу не збережено", "Не вдалося зберегти адресу на пристрої. Спробуйте ще раз."); }
    finally { setSaving(false); }
  };
  const openSource = async () => { try { await Linking.openURL(POWER_SOURCE); } catch { Alert.alert("Не вдалося відкрити сайт", "Спробуйте ще раз пізніше."); } };
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString(getLocale(), { timeZone: "Europe/Kyiv", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Не вказано оператором";
  return <SafeAreaView {...swipe} style={s.screen}>
    <StatusBar style={dark ? "light" : "dark"} />
    <ServiceHeader dark={dark} title={profile ? "Моя адреса" : "Світло за адресою"} onBack={onBack} onInfo={() => setInfo(true)} />
    <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {!restored ? <ActivityIndicator color={c.accent} accessibilityLabel="Завантаження" /> : <>
        <Pressable accessibilityRole="button" accessibilityLabel="Змінити адресу" disabled={saving} onPress={() => setEditing(true)} style={[s.card, styles.heading]}>
          <Ionicons name="location-outline" color={c.accent} size={22} /><View style={styles.flex}>{address ? <Text translate={false} style={s.body}>{addressLabel(address)}</Text> : <><Text style={s.body}>Вибрати адресу</Text><Text style={s.muted}>Населений пункт, вулиця та будинок</Text></>}</View><Ionicons name="chevron-forward" size={20} color={c.muted} />
        </Pressable>
        {address && <View style={s.card}>
          <View style={styles.heading}><Text accessibilityRole="header" style={[s.body, styles.flex]}>Дані оператора</Text><Pressable accessibilityRole="button" accessibilityLabel="Перевірити ще раз" disabled={loading || saving} style={s.iconButton} onPress={() => setRefresh(v => v + 1)}><Ionicons name="refresh-outline" size={22} color={c.accent} /></Pressable></View>
          {loading && <ActivityIndicator color={c.accent} accessibilityLabel="Перевіряємо відключення" />}
          {error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
          {status && (loading || error) && <Text style={s.muted}>Показуємо попередню перевірку. Поточний стан ще не підтверджено.</Text>}
          {status && <>
            <Text style={s.body}>{loading || error ? "Поточний стан ще не підтверджено." : powerStatusMessage(status, now)}</Text>
            {status.queues.length > 0 && <Text style={s.muted}>Черга погодинних відключень: {status.queues.join(", ")}</Text>}
            {status.outages.map(e => <View key={e.id} style={[styles.event, { borderColor: c.border }]}>
              <Text style={s.link}>{e.kind === "planned" ? "Планові роботи" : e.kind === "scheduled" ? "Графікове відключення" : "Аварійне відключення"}</Text>
              <Text style={s.muted}>{outagePeriod(e, now) === "future" ? "Заплановано" : outagePeriod(e, now) === "ended" ? "Зазначений час минув" : outagePeriod(e, now) === "current" ? "Поточний запис оператора" : "Час потребує уточнення"}</Text>
              {e.reason ? <Text translate={false} style={s.body}>{e.reason}</Text> : null}
              <Text style={s.muted}>Початок: {formatDate(e.startsAt)}</Text>
              <Text style={s.muted}>Орієнтовне відновлення: {formatDate(e.expectedRestoration)}</Text>
            </View>)}
            <Text style={s.muted}>Перевірено: {formatDate(status.checkedAt)}</Text>
          </>}
        </View>}
        {!address && error && <Text accessibilityRole="alert" style={s.body}>{error}</Text>}
        <Text style={s.muted}>Відсутність запису не гарантує наявності світла. Час відновлення орієнтовний.</Text>
        <Pressable accessibilityRole="button" style={styles.action} onPress={() => void openSource()}><Text style={s.link}>Відкрити сайт обленерго ↗</Text></Pressable>
      </>}
    </ScrollView>
    {editing && <AddressPicker dark={dark} initial={address} saving={saving} onSave={next => void save(next)} onClose={() => { if (!saving) setEditing(false); }} />}
    <ServiceSheet dark={dark} visible={info} onClose={() => setInfo(false)}>
      <Text style={s.title}>Про перевірку світла</Text>
      <Text style={s.body}>Адреса зберігається лише на цьому пристрої. Для перевірки передаємо її нашому серверу. Автооновлення — кожні 5 хвилин, лише поки цей екран відкритий і застосунок активний. Фонових перевірок і push-сповіщень поки немає.</Text>
      <Text style={s.muted}>Черга відключень — довідкова інформація, а не гарантія застосування графіка. Час відновлення визначає оператор.</Text>
      {status && <Text style={s.muted}>Оновлення джерела: {formatDate(status.sourceUpdatedAt)}</Text>}
      {status?.sourceUpdatedAt && Date.parse(status.sourceUpdatedAt) > now + 10 * 60_000 && <Text style={s.muted}>Джерело вказує час оновлення в майбутньому. Актуальність даних не підтверджено.</Text>}
      <PrimaryButton dark={dark} title="Закрити" onPress={() => setInfo(false)} />
    </ServiceSheet>
  </SafeAreaView>;
}

export function AddressPicker({ dark, initial, saving, onSave, onClose }: { dark: boolean; initial: PowerAddress | null; saving: boolean; onSave: (a: PowerAddress) => void; onClose: () => void }) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  const [city, setCity] = useState<PowerPlace | null>(initial?.city ?? null);
  const [street, setStreet] = useState<PowerPlace | null>(initial?.street ?? null);
  const [building, setBuilding] = useState(initial?.building ?? "");
  const [cities, setCities] = useState<PowerPlace[]>([]);
  const [streets, setStreets] = useState<PowerPlace[]>([]);
  const [query, setQuery] = useState("");
  const [cityStep, setCityStep] = useState(!initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError(null); setStreets([]);
    (cityStep ? getPowerCities() : city ? getPowerStreets(city.id) : Promise.resolve([])).then(next => {
      if (!active) return;
      if (cityStep) setCities(next); else { setStreets(next); if (street && !next.some(p => p.id === street.id)) setStreet(null); }
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "Не вдалося завантажити адреси."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [city?.id, cityStep, retry]);
  const chooseCity = (next: PowerPlace) => { setCity(next); setStreet(null); setBuilding(""); setQuery(""); setCityStep(false); };
  const list = (cityStep ? cities : streets).filter(p => p.name.toLocaleLowerCase("uk-UA").includes(query.trim().toLocaleLowerCase("uk-UA"))
      && (cityStep || !street || Boolean(query) || p.id === street.id))
    .sort((a, b) => cityStep ? Number(b.name === "Ужгород") - Number(a.name === "Ужгород") : 0).slice(0, 8);
  const next = decodeAddress({ city, street, building });
  const inputStyle = [styles.input, { color: c.ink, backgroundColor: c.soft, borderColor: c.border }];
  return <ServiceSheet dark={dark} visible dismissible={!saving} onClose={onClose}>
    <Text accessibilityRole="header" style={s.title}>Виберіть адресу</Text>
    {!cityStep && city && <Pressable disabled={saving} accessibilityRole="button" style={styles.action} onPress={() => { setCityStep(true); setQuery(""); }}><Text translate={false} style={s.link}>{city.name} · ↶</Text></Pressable>}
    <Text style={s.body}>{cityStep ? "Населений пункт" : "Вулиця"}</Text>
    <TextInput accessibilityLabel={cityStep ? "Пошук населеного пункту" : "Пошук вулиці"} editable={!saving} placeholder={cityStep ? "Пошук населеного пункту" : "Пошук вулиці"} value={query} onChangeText={setQuery} style={inputStyle} placeholderTextColor={c.muted} />
    {!street && <Text style={s.muted}>Показуємо до 8 збігів. Введіть назву для точнішого пошуку.</Text>}
    {loading ? <ActivityIndicator color={c.accent} /> : error ? <><Text accessibilityRole="alert" style={s.body}>{error}</Text><PrimaryButton dark={dark} title="Спробувати ще раз" onPress={() => setRetry(v => v + 1)} /></> : <View style={{ backgroundColor: c.soft, borderRadius: 12 }}>{list.map((p, index) => <ChoiceRow key={p.id} dark={dark} title={p.name} selected={cityStep ? city?.id === p.id : street?.id === p.id} disabled={saving} last={index === list.length - 1} onPress={() => { if (cityStep) chooseCity(p); else { if (p.id !== street?.id) setBuilding(""); setStreet(p); setQuery(""); } }} />)}{!list.length && <Text style={[s.muted, { padding: 16 }]}>Адрес не знайдено. Спробуйте іншу назву.</Text>}</View>}
    {!cityStep && <>
      <Text style={s.body}>Номер будинку</Text>
      <TextInput accessibilityLabel="Номер будинку" editable={!saving} placeholder="Наприклад, 12 або 12А" value={building} onChangeText={setBuilding} maxLength={20} style={inputStyle} placeholderTextColor={c.muted} autoCapitalize="characters" />
      {next && <Text translate={false} style={s.muted}>{addressLabel(next)}</Text>}
      <PrimaryButton dark={dark} title={saving ? "Зберігаємо…" : "Зберегти адресу"} disabled={!next || loading || Boolean(error) || saving} onPress={() => { if (next) onSave(next); }} />
    </>}
    <Pressable accessibilityRole="button" disabled={saving} style={styles.action} onPress={onClose}><Text style={s.link}>Скасувати</Text></Pressable>
  </ServiceSheet>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, heading: { flexDirection: "row", alignItems: "center", gap: 12 }, action: { minHeight: 48, paddingVertical: 12, justifyContent: "center" }, input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 }, event: { borderTopWidth: 1, paddingTop: 16, gap: 8 } });
