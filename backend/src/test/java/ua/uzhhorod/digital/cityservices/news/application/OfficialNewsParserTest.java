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
}
