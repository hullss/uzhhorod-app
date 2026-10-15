import { forwardRef, useSyncExternalStore, type ReactNode } from "react";
import { Alert as NativeAlert, Pressable as NativePressable, Text as NativeText, TextInput as NativeTextInput, type PressableProps, type TextProps, type TextInputProps } from "react-native";
import { getLanguage, setLanguage, subscribeLanguage, translate } from "./locale";
import { APP_FONTS } from "../ui/fonts";

export function useLanguage() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return [language, setLanguage] as const;
}
function translatedChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return translate(children);
  if (Array.isArray(children)) {
    if (children.every(child => child == null || typeof child === "boolean" || typeof child === "string" || typeof child === "number")) {
      const parts = children.filter(child => child != null && typeof child !== "boolean");
      const joined = parts.join("");
      const translated = translate(joined);
      return translated !== joined ? translated : parts.map(child => typeof child === "string" ? translate(child) : child).join("");
    }
    return children.map(translatedChildren);
  }
  return children;
}
export const Text = forwardRef<NativeText, TextProps & { translate?: boolean }>(function LocalizedText({ children, translate: localize = true, accessibilityLabel, ...props }, ref) {
  useLanguage();
  return <NativeText {...props} style={[{ fontFamily: APP_FONTS.regular }, props.style]} ref={ref} accessibilityLabel={accessibilityLabel && translate(accessibilityLabel)}>{localize ? translatedChildren(children) : children}</NativeText>;
});
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function LocalizedInput({ placeholder, accessibilityLabel, accessibilityHint, ...props }, ref) {
  useLanguage();
  return <NativeTextInput {...props} style={[{ fontFamily: APP_FONTS.regular }, props.style]} ref={ref} placeholder={placeholder && translate(placeholder)} accessibilityLabel={accessibilityLabel && translate(accessibilityLabel)} accessibilityHint={accessibilityHint && translate(accessibilityHint)} />;
});
export function Pressable({ accessibilityLabel, accessibilityHint, ...props }: PressableProps) {
  useLanguage();
  return <NativePressable {...props} accessibilityLabel={accessibilityLabel && translate(accessibilityLabel)} accessibilityHint={accessibilityHint && translate(accessibilityHint)} />;
}
export const Alert = {
  alert: (...args: Parameters<typeof NativeAlert.alert>) => {
    const [title, message, buttons, options] = args;
    NativeAlert.alert(translate(title), message && translate(message), buttons?.map(button => ({ ...button, text: button.text && translate(button.text) })), options);
  },
};
