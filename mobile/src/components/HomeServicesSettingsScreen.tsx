import { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text } from "../i18n/ui";
import { ScreenSafeArea } from "../ui/Screen";
import { DEFAULT_HOME_SERVICES, MAX_HOME_SERVICES, type HomeServiceId } from "../storage/homeServices";
import { civicStyles, civicTheme, PrimaryButton, ServiceHeader, useHardwareBack, useServiceSwipeBack } from "./CivicServiceUI";

export type HomeServiceOption = { id: HomeServiceId; title: string; icon: keyof typeof Ionicons.glyphMap; testScenario?: boolean };

export function HomeServicesSettingsScreen({ dark, options, selected, loadError, onRetry, onSave, onBack }: {
  dark: boolean; options: HomeServiceOption[]; selected: HomeServiceId[] | null; loadError: boolean;
  onRetry: () => void; onSave: (ids: HomeServiceId[]) => Promise<void>; onBack: () => void;
}) {
  const [draft, setDraft] = useState<HomeServiceId[]>(selected ?? DEFAULT_HOME_SERVICES);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const busy = useRef(false);
  useEffect(() => { if (selected) setDraft([...selected]); }, [selected]);
  const back = () => { if (!busy.current) onBack(); };
  const swipe = useServiceSwipeBack(back, !saving, busy); useHardwareBack(back);
  const s = civicStyles(dark); const c = civicTheme(dark);
  const loaded = selected !== null;
  async function save() {
    if (busy.current || !loaded) return;
    busy.current = true; setSaving(true); setSaveError(false);
    try { await onSave([...draft]); onBack(); }
    catch { setSaveError(true); }
    finally { busy.current = false; setSaving(false); }
  }
  function toggle(id: HomeServiceId) {
    if (busy.current || !loaded) return;
    setSaveError(false);
    setDraft(previous => previous.includes(id) ? previous.filter(item => item !== id)
      : previous.length < MAX_HOME_SERVICES ? [...previous, id] : previous);
  }
  return <ScreenSafeArea {...swipe} style={s.screen}>
    <ServiceHeader dark={dark} title="Сервіси на головній" onBack={back} disabled={saving} />
    <ScrollView contentContainerStyle={s.content}>
      <Text style={s.body}>Оберіть до 6 сервісів для швидкого доступу. Вони з’являться на головній у порядку вибору.</Text>
      <Text style={s.muted}>Вибір зберігається лише на цьому пристрої.</Text>
      {!loaded ? <View style={s.card}><Text style={s.body}>{loadError ? "Не вдалося прочитати вибір сервісів." : "Завантажуємо ваш вибір…"}</Text>
        {loadError && <PrimaryButton dark={dark} title="Повторити" onPress={onRetry} />}</View> : <>
        <Text accessibilityLiveRegion="polite" style={s.title}><Text>Обрано:</Text> {draft.length} / {MAX_HOME_SERVICES}</Text>
        {draft.length === MAX_HOME_SERVICES && <Text accessibilityLiveRegion="polite" style={s.muted}>Вибрано максимум 6. Приберіть один сервіс, щоб додати інший.</Text>}
        <View style={[s.card, { padding: 0, gap: 0 }]}>{options.map((option, index) => {
          const position = draft.indexOf(option.id); const checked = position >= 0;
          const disabled = saving || (!checked && draft.length >= MAX_HOME_SERVICES);
          return <Pressable key={option.id} accessibilityRole="checkbox" accessibilityLabel={option.title}
            accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => toggle(option.id)}
            style={[s.row, index < options.length - 1 && s.divider, { minHeight: 64 }]}>
            <Ionicons name={option.icon} size={23} color={c.accent} />
            <View style={{ flex: 1, gap: 2 }}><Text style={s.body}>{option.title}</Text>
              {option.testScenario && <Text style={s.muted}>Тестовий сценарій</Text>}</View>
            {checked && <Text style={s.muted}>{position + 1}</Text>}
            <Ionicons name={checked ? "checkbox" : "square-outline"} size={25} color={checked ? c.accent : c.muted} />
          </Pressable>;
        })}</View>
        {saveError && <Text accessibilityRole="alert" style={[s.body, { color: dark ? "#ffb4ab" : "#a12b2b" }]}>Не вдалося зберегти вибір. Спробуйте ще раз.</Text>}
        <PrimaryButton dark={dark} title={saving ? "Зберігаємо…" : "Зберегти"} disabled={saving} onPress={() => void save()} />
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setDraft([...DEFAULT_HOME_SERVICES]); setSaveError(false); }} style={[s.row, { justifyContent: "center" }]}>
          <Text style={s.link}>Повернути стандартні</Text>
        </Pressable>
      </>}
    </ScrollView>
  </ScreenSafeArea>;
}
