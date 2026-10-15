import { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
export const AppThemeContext = createContext<boolean | null>(null);
export function useAppTheme() {
  const system = useColorScheme(); const chosen = useContext(AppThemeContext);
  return chosen ?? system === "dark";
}
