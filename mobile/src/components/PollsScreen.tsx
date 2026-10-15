import { Text } from "../i18n/ui";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { ScreenSafeArea as SafeAreaView } from "../ui/Screen";
import { CITY_POLL, createVote, type PollVote } from "../civic/demoCivic";
import { persistVote, restoreVote } from "../storage/demoCivic";
import { ChoiceRow, civicStyles, civicTheme, PrimaryButton, SecondaryButton, ServiceHeader, ServiceSheet, ServiceTabs, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export function PollsScreen({ isDarkTheme: dark, onBack }: { isDarkTheme: boolean; onBack: () => void }) {
  const s = civicStyles(dark); const c = civicTheme(dark);
  const [tab, setTab] = useState(0);
  const [panel, setPanel] = useState<"none" | "info" | "poll">("none");
  const [vote, setVote] = useState<PollVote | null>(null);
  const [selected, setSelected] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const saving = useRef(false);
  const load = useCallback(async () => {
    setLoaded(false); setError("");
    try { const restored = await restoreVote(); setVote(restored); setSelected(restored?.optionId ?? ""); setLoaded(true); }
    catch { setError("Не вдалося прочитати збережений голос. Спробуйте ще раз — попередній вибір не буде перезаписано."); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const back = useCallback(() => { if (saving.current) return; panel === "none" ? onBack() : setPanel("none"); }, [panel, onBack]);
  useHardwareBack(back);
  const swipe = useServiceSwipeBack(back, !busy);
  async function submit() {
    if (!loaded || saving.current || vote || !selected) return;
    saving.current = true; setBusy(true); setError("");
    try { const next = createVote(selected, vote); await persistVote(next); setVote(next); }
    catch { setError("Голос не збережено. Спробуйте ще раз — вибір залишився у формі."); }
    finally { saving.current = false; setBusy(false); }
  }
  return <SafeAreaView {...swipe} style={s.screen}>
    <StatusBar style={dark ? "light" : "dark"} />
    <View style={{ flex: 1 }} accessibilityElementsHidden={panel !== "none"} importantForAccessibility={panel !== "none" ? "no-hide-descendants" : "auto"} aria-hidden={panel !== "none"}>
    <ServiceHeader dark={dark} title="Опитування" onBack={back} onInfo={() => { if (!busy) setPanel("info"); }} />
    <ServiceTabs dark={dark} labels={["Активні", "Завершені"]} selected={tab} onChange={setTab} />
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
      {!loaded && !error && <ActivityIndicator color={c.accent} accessibilityLabel="Завантажуємо ваш голос" />}
      {!!error && panel === "none" && <View style={{ gap: 12 }}><Text accessibilityLiveRegion="polite" style={s.body}>{error}</Text>{!loaded && <PrimaryButton dark={dark} title="Спробувати ще раз" onPress={() => void load()} />}</View>}
      {tab === 0 && <View style={s.card}>
        <Text style={s.muted}>Приклад міського опитування</Text>
        <Text accessibilityRole="header" style={s.title}>{CITY_POLL.title}</Text>
        <Text style={s.muted}>{vote ? "Ви вже проголосували · вибір збережено" : "Одна відповідь · з підтвердженням вибору"}</Text>
        <PrimaryButton dark={dark} disabled={!loaded} title={vote ? "Переглянути мій голос" : "Взяти участь"} onPress={() => setPanel("poll")} />
      </View>}
      {tab === 1 && <View style={s.empty}>
        <Ionicons name="reader-outline" size={48} color={c.muted} />
        <Text accessibilityRole="header" style={[s.title, { textAlign: "center" }]}>Завершених опитувань ще немає</Text>
        <Text style={[s.muted, { textAlign: "center" }]}>Після завершення опитування тут з’являться його результати.</Text>
      </View>}
    </ScrollView>
    </View>
    <ServiceSheet dark={dark} visible={panel !== "none"} dismissible={!busy} onClose={() => { if (!busy) setPanel("none"); }}>
      {panel === "info" && <>
        <Text accessibilityRole="header" style={s.title}>Ваш голос для міста</Text>
        <Text style={s.body}>Активні опитування приймають відповіді. Після офіційного завершення їхні результати будуть у вкладці «Завершені». Ваш голос не завершує опитування для інших.</Text>
        <Text style={s.muted}>Зараз показуємо один приклад. Вибір зберігається лише на цьому пристрої, не в акаунті й не надсилається місту. Загальні відсотки й кількість учасників не показуємо без серверних даних.</Text>
        <PrimaryButton dark={dark} title="Зрозуміло" onPress={() => setPanel("none")} />
      </>}
      {panel === "poll" && <>
        <Text accessibilityRole="header" style={s.title}>{CITY_POLL.title}</Text><Text style={s.body}>{CITY_POLL.description}</Text>
        {vote && <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.soft, borderRadius: 12, padding: 16, gap: 6 }}><Text style={s.link}>Ваш голос збережено</Text><Text style={s.muted}>Вибір залишиться після перезапуску. Повторно голосувати в цьому прикладі не можна.</Text></View>}
        <View>{CITY_POLL.options.map((option, index) => <ChoiceRow key={option.id} dark={dark} title={option.title} selected={selected === option.id} disabled={!!vote || busy} onPress={() => setSelected(option.id)} last={index === CITY_POLL.options.length - 1} />)}</View>
        {!!error && <Text accessibilityLiveRegion="polite" style={s.body}>{error}</Text>}
        {!vote && <PrimaryButton dark={dark} title={busy ? "Зберігаємо…" : "Проголосувати"} disabled={!loaded || !selected || busy} onPress={() => void submit()} />}
        {!vote && <Text style={s.muted}>Голос збережеться на пристрої після натискання «Проголосувати».</Text>}
        <SecondaryButton dark={dark} title="Закрити" disabled={busy} onPress={() => { setPanel("none"); setError(""); }} />
      </>}
    </ServiceSheet>
  </SafeAreaView>;
}
