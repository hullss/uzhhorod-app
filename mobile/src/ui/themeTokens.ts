export const COLOR_TOKENS = {
  light: { bg: "#f6f7fb", surface: "#ffffff", soft: "#eef4ff", ink: "#0f1d2a", muted: "#5b6b7c", border: "#e2e8f0", accent: "#123a63", button: "#123a63", controlBorder: "#73879d", tertiary: "#66758a" },
  dark: { bg: "#071b2f", surface: "#102d49", soft: "#153a59", ink: "#f3f7fc", muted: "#a9bed3", border: "#234561", accent: "#8fc8ff", button: "#174b75", controlBorder: "#7399b9", tertiary: "#91a9bf" },
} as const;
export const themeTokens = (dark: boolean) => dark ? COLOR_TOKENS.dark : COLOR_TOKENS.light;
