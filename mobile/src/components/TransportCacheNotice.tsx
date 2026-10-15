import { Text } from "../i18n/ui";
import { getLocale } from "../i18n/locale";
import { getTransportSnapshotInfo } from "../api/transport";
import { useAppTheme } from "../ui/theme";
import { civicStyles } from "./CivicServiceUI";
export function TransportCacheNotice({ value }: { value: unknown }) {
  const dark = useAppTheme(); const info = getTransportSnapshotInfo(value);
  if (!info?.offline) return null;
  const date = new Date(info.savedAt).toLocaleString(getLocale(), { timeZone: "Europe/Kyiv", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return <Text accessibilityRole="alert" style={civicStyles(dark).muted}>Збережений каталог · отримано {date}. Сервер недоступний; зміни розкладу не перевірено.</Text>;
}
