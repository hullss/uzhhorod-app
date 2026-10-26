package ua.uzhhorod.digital.cityservices.news.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsItemResponse;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsArticleResponse;

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
    void keepsThePreviewCompatibleWithOlderClients() {
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
        assertThat(article.fullTextAvailable()).isFalse();
    }

    @Test
    void readsTheEntireCmsBodyBeyond720CharactersAndKeepsNestedContent() {
        String longText = "Повний текст новини. ".repeat(90);
        var article = OfficialNewsParser.parseArticle("""
                <p>Навігація, не стаття</p><article class="post-content"><h1>Новина</h1>
                <p class="post-listing-item-date">Опубліковано: жовтня 08, 2026</p>
                <div class="post-item-inner-content other-class"><p>%s</p>
                <div><h2>Подробиці</h2><p>Вкладений абзац</p></div><p>Останній абзац</p></div>
                </article><footer><p>Контакти сайту</p></footer>
                """.formatted(longText), "https://rada-uzhgorod.gov.ua/post/news", null);
        assertThat(article.fullTextAvailable()).isTrue();
        assertThat(article.blocks()).extracting(OfficialNewsArticleResponse.Block::text)
                .containsExactly(longText.trim(), "Подробиці", "Вкладений абзац", "Останній абзац");
        assertThat(article.blocks().get(1).type()).isEqualTo("heading");
        assertThat(article.preview().length()).isLessThanOrEqualTo(721);
        assertThat(article.publishedLabel()).isEqualTo("жовтня 08, 2026");
    }

    @Test
    void keepsListsLineBreaksEntitiesAndOnlySafeLinks() {
        var article = OfficialNewsParser.parseArticle("""
                <article><h1>Новина</h1><img src="/media/photo.jpg">
                <div class='post-item-inner-content'>
                <p>Місто &amp; громада: &#x423;&#1078;город<br>Другий рядок</p>
                <ol><li><p>Перший пункт</p></li><li>Другий пункт</li></ol>
                <ul><li>Ще один пункт</li></ul>
                <p><a href='/media/document.pdf'>Документ</a></p>
                <p><a href='javascript:alert(1)'>Не виконувати</a></p>
                <script>Небезпечний код</script><style>Прихований стиль</style>
                <aside><p>Рекомендовані матеріали</p></aside>
                </div></article>
                """, "https://rada-uzhgorod.gov.ua/post/news", null);
        assertThat(article.blocks()).extracting(OfficialNewsArticleResponse.Block::text)
                .containsExactly("Місто & громада: Ужгород\nДругий рядок", "1. Перший пункт", "2. Другий пункт",
                        "• Ще один пункт", "Документ", "Не виконувати");
        assertThat(article.links()).containsExactly(new OfficialNewsArticleResponse.Link(
                "Документ", "https://rada-uzhgorod.gov.ua/media/document.pdf"));
        assertThat(article.imageUrl()).isEqualTo("https://rada-uzhgorod.gov.ua/media/photo.jpg");
    }

    @Test
    void excludesPhotoGalleryLinksButKeepsDocumentsAndUsefulExternalLinks() {
        String gallery = java.util.stream.IntStream.range(0, 34)
                .mapToObj(index -> "<a href='/media/photo-" + index + ".JPG?version=2'><img src='/media/thumb.jpg'></a>")
                .collect(java.util.stream.Collectors.joining());
        var article = OfficialNewsParser.parseArticle("""
                <article><h1>Міська новина</h1><img src='/media/cover.jpg'>
                <div class='post-item-inner-content'><p>Повний текст новини.</p>%s
                <a href='/media/photo.webp#large'>Фото</a>
                <a href='/media/photo?id=35'><img src='/media/thumb.jpg'></a>
                <a href='#carousel-post-18534'><span>Переглянути фото</span></a>
                <a href='/media/decision.pdf?download=1'>Рішення міської ради</a>
                <a href='https://example.org/registration'>Зареєструватися на подію</a>
                <a href='/media/decision.pdf?download=1'>Повтор документа</a>
                <a href='/media/table.xlsx'><img src='/media/download-icon.png'></a>
                </div></article>
                """.formatted(gallery), "https://rada-uzhgorod.gov.ua/post/news", null);

        assertThat(article.fullTextAvailable()).isTrue();
        assertThat(article.blocks().getFirst().text()).isEqualTo("Повний текст новини.");
        assertThat(article.imageUrl()).isEqualTo("https://rada-uzhgorod.gov.ua/media/cover.jpg");
        assertThat(article.links()).containsExactly(
                new OfficialNewsArticleResponse.Link("Рішення міської ради", "https://rada-uzhgorod.gov.ua/media/decision.pdf?download=1"),
                new OfficialNewsArticleResponse.Link("Зареєструватися на подію", "https://example.org/registration"),
                new OfficialNewsArticleResponse.Link("Відкрити посилання", "https://rada-uzhgorod.gov.ua/media/table.xlsx"));
    }

    @Test
    void doesNotPretendMenusOrBrokenContainersAreAFullArticle() {
        for (String html : List.of("<p>Меню</p><footer><p>Контакти</p></footer>",
                "<article><h1>Заголовок</h1><div class='post-item-inner-content'><p>Неповна сторінка</p></article>")) {
            var article = OfficialNewsParser.parseArticle(html, "https://rada-uzhgorod.gov.ua/post/news", null);
            assertThat(article.fullTextAvailable()).isFalse();
            assertThat(article.blocks()).isEmpty();
            assertThat(article.preview()).isEmpty();
        }
    }

    @Test
    void doesNotAcceptTrackingOrExecutableImageUrls() {
        for (String url : List.of("https://another.example/photo.jpg", "javascript:alert(1)",
                "https://user:password@rada-uzhgorod.gov.ua/photo.jpg")) {
            var article = OfficialNewsParser.parseArticle("<article><img src='" + url
                    + "'><div class='post-item-inner-content'><p>Новина</p></div></article>",
                    "https://rada-uzhgorod.gov.ua/post/news", null);
            assertThat(article.imageUrl()).isNull();
        }
    }

    @Test
    void readsTheVerifiedCouncilMarkupWithAllFiveParagraphs() throws Exception {
        try (var fixture = getClass().getResourceAsStream("/news/council-article.html")) {
            assertThat(fixture).isNotNull();
            String html = new String(fixture.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
            var article = OfficialNewsParser.parseArticle(html, "https://rada-uzhgorod.gov.ua/post/v-uzhhorodi-16", null);
            assertThat(article.fullTextAvailable()).isTrue();
            assertThat(article.blocks()).hasSize(5);
            assertThat(article.blocks().getFirst().text()).contains("об’єднає");
            assertThat(article.blocks().getLast().text()).endsWith("«ПАДІЮН».");
            assertThat(article.blocks().stream().mapToInt(block -> block.text().length()).sum()).isGreaterThan(720);
        }
    }
}
