package ua.uzhhorod.digital.cityservices.opendata.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class OpenDataDatasetParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void createsAnOfficialDatasetLinkAndUsesModifiedDate() throws Exception {
        var dataset = objectMapper.readTree("""
                {
                  "name": "parking-lots",
                  "title": "Parking lots",
                  "notes": " Official   parking data ",
                  "metadata_modified": "2026-09-22T14:35:00"
                }
                """);

        var result = OpenDataDatasetParser.parse(dataset, "https://data.rada-uzhgorod.gov.ua");

        assertThat(result.title()).isEqualTo("Parking lots");
        assertThat(result.description()).isEqualTo("Official parking data");
        assertThat(result.sourceUrl()).isEqualTo("https://data.rada-uzhgorod.gov.ua/dataset/parking-lots");
        assertThat(result.updatedAt()).hasToString("2026-09-22T14:35:00Z");
    }
}
