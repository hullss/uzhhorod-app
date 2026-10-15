import { EN } from "./catalogue";
export type Language = "uk" | "en";
let language: Language = "uk";
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const getLocale = () => language === "en" ? "en-GB" : "uk-UA";
export function setLanguage(next: Language) {
  if (next !== "uk" && next !== "en") return;
  if (next === language) return;
  language = next;
  listeners.forEach(listener => listener());
}
export function subscribeLanguage(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const templates = Object.entries(EN).filter(([key]) => key.includes("{{")).map(([key, value]) => {
  const parts = key.split(/\{\{\d+\}\}/);
  return { regex: new RegExp(`^${parts.map(escape).join("(.+?)")}$`, "u"), value };
});
export function translate(value: string, lang: Language = language): string {
  if (lang === "uk" || !value || !/[а-яіїєґ]/iu.test(value)) return value;
  const key = value.trim();
  let result = EN[key];
  if (!result) for (const template of templates) {
    const match = key.match(template.regex);
    if (match) { result = template.value.replace(/\{\{(\d+)\}\}/g, (_, index: string) => translate(match[Number(index) + 1], lang)); break; }
  }
  if (!result) {
    // Combined accessibility labels and short metadata; never translate arbitrary content word-by-word.
    const parts = key.split(/( · |\. )/);
    if (parts.length > 1) result = parts.map(part => translate(part, lang)).join("");
  }
  return result ? value.slice(0, value.length - value.trimStart().length) + result + value.slice(value.trimEnd().length) : value;
}
