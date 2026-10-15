/** Isolated QA entry. Not imported by App.tsx or shipped as an app screen. */
import { registerRootComponent } from "expo";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { NewsArticleScreen } from "../src/components/NewsArticleScreen";

// Route only this isolated reader's public article request to the QA fixture server.
const qaFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  return url.includes("/api/city-services/news/article?")
    ? qaFetch(`http://localhost:8090${new URL(url).pathname}${new URL(url).search}`, options)
    : qaFetch(input, options);
};

function Preview() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(true);
  return <View style={{ flex: 1 }}>
    <View style={{ padding: 6, backgroundColor: "#e2e8f0", flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Text>QA читача</Text>
      <Pressable accessibilityRole="button" onPress={() => setDark(!dark)} style={{ padding: 8, minHeight: 44 }}><Text>{dark ? "Світла тема" : "Темна тема"}</Text></Pressable>
      {!open && <Pressable accessibilityRole="button" onPress={() => setOpen(true)}><Text>Відкрити</Text></Pressable>}
    </View>
    {open ? <NewsArticleScreen dark={dark} item={{ title: "Книга-фест", sourceUrl: "https://rada-uzhgorod.gov.ua/post/v-uzhhorodi-16", publishedLabel: "жовтня 08, 2026" }} backLabel="Назад" onBack={() => setOpen(false)} onOpenLink={async () => {}} /> : <Text>Повернення працює</Text>}
  </View>;
}
registerRootComponent(Preview);
