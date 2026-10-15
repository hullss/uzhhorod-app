import { Pressable, Text } from "../i18n/ui";
import { translate } from "../i18n/locale";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from "react-native";
import { ScreenSafeArea as SafeAreaView } from "../ui/Screen";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { getOfficialNewsArticle, type OfficialNewsArticle, type OfficialNewsItem } from "../api/cityServices";
import { LatestRequest } from "../utils/latestRequest";
import { newsDateLabel } from "../news/article";
import { APP_FONTS } from "../ui/fonts";
import { PAGE_LAYOUT } from "../ui/layout";
import { civicStyles, civicTheme, ServiceHeader, useServiceSwipeBack } from "./CivicServiceUI";

export function NewsArticleScreen({ item, dark, backLabel, onBack, onOpenLink }: {
  item: OfficialNewsItem; dark: boolean; backLabel: string; onBack: () => void; onOpenLink: (url: string) => Promise<void>;
}) {
  const [article, setArticle] = useState<OfficialNewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageRatio, setImageRatio] = useState(1.6);
  const requests = useRef(new LatestRequest()).current;
  const scroll = useRef<ScrollView>(null);
  const swipe = useServiceSwipeBack(onBack);
  const c = civicTheme(dark); const s = civicStyles(dark);

  useEffect(() => {
    setArticle(null); setImageFailed(false); scroll.current?.scrollTo({ y: 0, animated: false });
    void loadArticle();
    return () => requests.invalidate();
  }, [item.sourceUrl]);

  useEffect(() => {
    let active = true; setImageRatio(1.6);
    if (article?.imageUrl) Image.getSize(article.imageUrl, (width, height) => {
      if (active && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) setImageRatio(width / height);
    }, () => undefined);
    return () => { active = false; };
  }, [article?.imageUrl]);

  async function loadArticle() {
    const revision = requests.begin(); setLoading(true); setError(null);
    try {
      const result = await getOfficialNewsArticle(item);
      if (requests.isCurrent(revision)) setArticle(result);
    } catch (requestError) {
      if (requests.isCurrent(revision)) setError(requestError instanceof Error ? requestError.message : "Не вдалося завантажити новину.");
    } finally { if (requests.isCurrent(revision)) setLoading(false); }
  }
  const date = article?.publishedLabel || item.publishedLabel;
  return <SafeAreaView {...swipe} style={s.screen}>
    <StatusBar style={dark ? "light" : "dark"} />
    <ServiceHeader dark={dark} title="Новина" onBack={onBack} backLabel={backLabel} />
    <ScrollView ref={scroll} testID="news-article-scroll" tabIndex={0} contentContainerStyle={ui.content}>
      <Text translate={false} accessibilityRole="header" selectable style={[ui.title, { color: c.ink }]}>{article?.title || item.title}</Text>
      <Text style={[ui.metadata, { color: c.muted }]}>Ужгородська міська рада{date ? ` · ${newsDateLabel(date)}` : ""}</Text>
      {loading ? <View accessibilityLabel={translate("Завантаження новини")} style={ui.loading}><ActivityIndicator color={c.accent} /></View> : null}
      {error ? <View accessibilityLiveRegion="polite" style={ui.notice}>
        <Text style={s.body}>{error}</Text>
        <Pressable accessibilityRole="button" style={ui.link} onPress={() => void loadArticle()}><Text style={s.link}>Спробувати ще раз</Text></Pressable>
      </View> : null}
      {!loading && !error && article ? <>
        {article.imageUrl && !imageFailed ? <Image accessibilityLabel={translate(`Фото до новини: ${article.title}`)} source={{ uri: article.imageUrl }} style={[ui.image, { aspectRatio: imageRatio }]} resizeMode="contain" onError={() => setImageFailed(true)} /> : null}
        {article.fullTextAvailable ? <View style={ui.body}>
          {article.blocks.map((block, index) => <Text translate={false} key={index} selectable accessibilityRole={block.type === "heading" ? "header" : undefined}
            style={[ui.paragraph, { color: c.ink }, block.type === "heading" && ui.heading, block.type === "listItem" && ui.listItem]}>{block.text}</Text>)}
          {article.links.length > 0 ? <View style={[ui.links, { borderColor: c.border }]}>
            <Text accessibilityRole="header" style={[ui.linkTitle, { color: c.ink }]}>Посилання з матеріалу</Text>
            {article.links.map(link => <Pressable key={link.url} accessibilityRole="link" accessibilityLabel={link.title} style={ui.link} onPress={() => void onOpenLink(link.url)}>
              <Text style={[ui.linkText, { color: c.accent }]}>{link.title}</Text><Ionicons name="open-outline" size={18} color={c.accent} />
            </Pressable>)}
          </View> : null}
        </View> : <View style={ui.body}>
          {article.preview ? <><Text accessibilityRole="header" style={[ui.linkTitle, { color: c.ink }]}>Коротко</Text><Text translate={false} selectable style={[ui.paragraph, { color: c.ink }]}>{article.preview}</Text></> : null}
          <Text style={s.muted}>Не вдалося отримати повний текст цієї публікації. Оригінал можна прочитати на сайті міськради.</Text>
        </View>}
      </> : null}
      <Pressable accessibilityRole="link" accessibilityLabel="Відкрити оригінал публікації на сайті міськради" style={[ui.original, { borderColor: c.border }]} onPress={() => void onOpenLink(item.sourceUrl)}>
        <Text style={[ui.linkText, { color: c.accent }]}>Оригінал публікації</Text><Ionicons name="open-outline" size={18} color={c.accent} />
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const ui = StyleSheet.create({
  navigation: { borderBottomWidth: 1, paddingHorizontal: PAGE_LAYOUT.gutter, paddingVertical: 4 },
  back: { alignSelf: "flex-start", minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  backText: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 16, lineHeight: 24 },
  content: { paddingHorizontal: PAGE_LAYOUT.gutter, paddingTop: PAGE_LAYOUT.section, paddingBottom: PAGE_LAYOUT.bottom, width: "100%", maxWidth: 760, alignSelf: "center" },
  title: { fontFamily: APP_FONTS.bold, fontWeight: "700", fontSize: 25, lineHeight: 33 },
  metadata: { fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 13, lineHeight: 20, marginTop: 12, marginBottom: 24 },
  loading: { paddingVertical: 32 },
  notice: { gap: 8, marginBottom: 20 },
  image: { width: "100%", borderRadius: 12, marginBottom: 24 },
  body: { gap: 18 },
  paragraph: { fontFamily: APP_FONTS.regular, fontWeight: "400", fontSize: 16, lineHeight: 26 },
  heading: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 20, lineHeight: 28, marginTop: 8 },
  listItem: { paddingLeft: 8 },
  links: { borderTopWidth: 1, paddingTop: 20, gap: 4 },
  linkTitle: { fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 16, lineHeight: 24, marginBottom: 8 },
  link: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  linkText: { flex: 1, fontFamily: APP_FONTS.semibold, fontWeight: "600", fontSize: 15, lineHeight: 24 },
  original: { borderTopWidth: 1, marginTop: 28, paddingVertical: 16, minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10 },
});
