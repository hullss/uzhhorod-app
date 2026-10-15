import { Platform } from "react-native";

// Use the platform's Ukrainian-capable UI family for both languages. Weight is
// explicit in styles; do not load a Latin-only font and rely on mixed fallback metrics.
const family = Platform.OS === "web" ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" : Platform.OS === "ios" ? "System" : "sans-serif";

export const APP_FONTS = {
  regular: family,
  medium: family,
  semibold: family,
  bold: family,
} as const;
