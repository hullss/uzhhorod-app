package ua.uzhhorod.digital.cityservices.miniatures.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import ua.uzhhorod.digital.cityservices.miniatures.api.MiniSculptureListResponse;

class MiniSculptureCatalogServiceTest {
    private final ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void expandsCatalogWithoutLosingOriginalIdentitiesOrInventingExactDates() throws Exception {
        var catalog = new MiniSculptureCatalogService(mapper).getCatalog();
        assertThat(catalog.sculptures()).hasSize(83);
        assertThat(catalog.sculptures()).extracting(point -> point.id()).doesNotHaveDuplicates().contains(
                "mikolaychyk", "mayak-ungvar", "ferenc-liszt", "svejk", "vuzol-krotona", "havrylo-hliuk",
                "karpatiia", "ihlavski-yizhachky", "john-lord", "malyi-uzh", "michael-strank", "bela-bartok",
                "krtchek", "nashi-kozaky", "uzhanska-rusalonka", "alma-mater", "legendy-zamkiv", "castrum-ung",
                "ekskursovod", "laszlo-biro", "nandor-ploteni");
        assertThat(catalog.verificationNotice()).contains("на місці їх не перевіряли");
        assertThat(catalog.sculptures()).allSatisfy(point -> {
            assertThat(point.sourceUrls()).isNotEmpty();
            assertThat(point.sourceUrls()).allMatch(url -> url.startsWith("https://"));
            assertThat(point.latitude()).isBetween(48.56, 48.70);
            assertThat(point.longitude()).isBetween(22.16, 22.42);
            assertThat(point.summary()).isNotBlank();
        });
        var restored = mapper.readValue(mapper.writeValueAsString(catalog), MiniSculptureListResponse.class);
        assertThat(restored).isEqualTo(catalog);
        assertThatThrownBy(() -> catalog.sculptures().clear()).isInstanceOf(UnsupportedOperationException.class);
        assertThatThrownBy(() -> catalog.sculptures().getFirst().sourceUrls().clear()).isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void correctsMisidentifiedSubjectsAndAccountsForRestorationAndRelocation() {
        var points = new MiniSculptureCatalogService(mapper).getCatalog().sculptures();
        var river = points.stream().filter(point -> point.id().equals("malyi-uzh")).findFirst().orElseThrow();
        assertThat(river.summary()).contains("рибини").doesNotContain("водолаз");
        var knot = points.stream().filter(point -> point.id().equals("vuzol-krotona")).findFirst().orElseThrow();
        assertThat(knot.summary()).contains("Фірцака").doesNotContain("математич");
        assertThat(knot.installedAt()).isNull();
        assertThat(knot.installedYear()).isEqualTo(2014);
        var professor = points.stream().filter(point -> point.id().equals("professor-in-trench")).findFirst().orElseThrow();
        assertThat(professor.address()).contains("лялькового театру");
        assertThat(professor.latitude()).isLessThan(48.63);
        assertThat(points.stream().filter(point -> point.id().equals("john-lord")).findFirst().orElseThrow().author())
                .contains("Колодко", "відновлення", "Мурник");
    }
}
