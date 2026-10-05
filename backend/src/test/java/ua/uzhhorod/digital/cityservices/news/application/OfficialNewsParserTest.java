package ua.uzhhorod.digital.cityservices.news.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsItemResponse;

class OfficialNewsParserTest {

    @Test
    void extractsDistinctPostsAndTheirPublishedLabels() {
        String page = """
                <article>
                  <h3><a href=\"/post/persha-novyna\">Перша &amp; важлива новина</a></h3>
                  <span>вересня 25, 2026</span>
                </article>
                <article>
                  <h3><a href=\"https://rada-uzhgorod.gov.ua/post/druga\">Друга новина</a></h3>
                  <time>вересня 24, 2026</time>
                </article>
                <a href=\"/post/persha-novyna\">Перша &amp; важлива новина</a>
                """;

        List<OfficialNewsItemResponse> items = OfficialNewsParser.parse(page, "https://rada-uzhgorod.gov.ua/");

        assertThat(items).containsExactly(
                new OfficialNewsItemResponse(
                        "Перша & важлива новина",
                        "https://rada-uzhgorod.gov.ua/post/persha-novyna",
                        "вересня 25, 2026"),
                new OfficialNewsItemResponse(
                        "Друга новина",
                        "https://rada-uzhgorod.gov.ua/post/druga",
                        "вересня 24, 2026"));
    }

    @Test
    void putsNewestDatedPostsBeforeUndatedPinnedPosts() {
        String page = """
                <a href="/post/old-pinned">Старий закріплений матеріал</a>
                <a href="/post/yesterday">Учорашня новина</a><span>жовтня 01, 2026</span>
                <a href="/post/today">Сьогоднішня новина</a><span>жовтня 02, 2026</span>
                """;

        List<OfficialNewsItemResponse> items = OfficialNewsParser.parse(page, "https://rada-uzhgorod.gov.ua/");

        assertThat(items).extracting(OfficialNewsItemResponse::title)
                .containsExactly("Сьогоднішня новина", "Учорашня новина", "Старий закріплений матеріал");
    }

    @Test
    void extractsAShortAttributedPreviewWithoutCopyingTheWholeArticle() {
        var article = OfficialNewsParser.parseArticle("""
                <html>
                  <head><meta property="og:description" content="Короткий офіційний опис події."></head>
                  <body><article><h1>Заголовок публікації</h1><p>Повний текст не потрібен для короткого перегляду.</p></article></body>
                </html>
                """, "https://rada-uzhgorod.gov.ua/post/novyna", "вересня 28, 2026");

        assertThat(article.title()).isEqualTo("Заголовок публікації");
        assertThat(article.preview()).isEqualTo("Короткий офіційний опис події.");
        assertThat(article.sourceUrl()).isEqualTo("https://rada-uzhgorod.gov.ua/post/novyna");
        assertThat(article.publishedLabel()).isEqualTo("вересня 28, 2026");
    }
}
