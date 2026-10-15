import { View } from "react-native";
import { Text } from "../i18n/ui";
import { civicStyles, SecondaryButton } from "./CivicServiceUI";

/** Read errors are not missing data. A retry never clears the original record. */
export function StorageRecoveryNotice({ dark, onRetry }: { dark: boolean; onRetry: () => void }) {
  const s = civicStyles(dark);
  return <View accessibilityLiveRegion="polite" style={{ gap: 8 }}>
    <Text style={s.body}>Не вдалося прочитати збережені дані.</Text>
    <Text style={s.muted}>Ми не очищали їх. Автоматичне перезаписування призупинено; повторіть спробу.</Text>
    <SecondaryButton dark={dark} title="Повторити відновлення" onPress={onRetry} />
  </View>;
}
