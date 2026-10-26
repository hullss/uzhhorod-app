package ua.uzhhorod.digital.cityservices.accessibility.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class AccessibleBuildingParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void readsCurrentCityResourceWithoutLosingMonitoringDatesOrLeadingZeros() throws Exception {
        try (var fixture = getClass().getResourceAsStream("/accessibility/buildings-current.json")) {
            assertThat(fixture).isNotNull();
            var records = objectMapper.readTree(fixture);
            var department = AccessibleBuildingParser.parse(records.get(0));
            assertThat(department.id()).isEqualTo("03192997");
            assertThat(department.address()).isEqualTo("площа Шандора Петефі, 24");
            assertThat(department.monitoredAt()).hasToString("2024-01-01");
            var hospital = AccessibleBuildingParser.parse(records.get(1));
            assertThat(hospital.id()).isEqualTo("13");
            assertThat(hospital.address()).isEqualTo("Олександра Грибоєдова, 20");
            assertThat(hospital.monitoredAt()).hasToString("2024-02-10");

            // CKAN row numbers may change on reimport; the city's UID must survive it.
            ((com.fasterxml.jackson.databind.node.ObjectNode) records.get(0)).put("_id", 999);
            assertThat(AccessibleBuildingParser.parse(records.get(0)).id()).isEqualTo(department.id());
        }
    }

    @Test
    void keepsBuildingSuffixesAndDoesNotDisplayLiteralNullValues() throws Exception {
        var record = objectMapper.readTree("""
                {"uid":"8", "monitoringDate":"invalid", "date":"2024-03-01",
                 "entityName":" NULL ", "buildingName":"Амбулаторія",
                 "addressThoroughfare":"Гранітна", "addressLocatorDesignator":"8",
                 "addressLocatorBuilding":"а", "addressLocatorDesignatorBuilding":" null "}
                """);
        var building = AccessibleBuildingParser.parse(record);
        assertThat(building.name()).isEqualTo("Амбулаторія");
        assertThat(building.address()).isEqualTo("Гранітна, 8 а");
        assertThat(building.monitoredAt()).hasToString("2024-03-01");
    }

    @Test void missingBuildingIdHasStableNonEmptyIdentity() throws Exception {
        var a = objectMapper.readTree("{\"entityName\":\"A\",\"addressThoroughfare\":\"Street\"}");
        var b = objectMapper.readTree("{\"entityName\":\"B\",\"addressThoroughfare\":\"Street\"}");
        assertThat(AccessibleBuildingParser.parse(a).id()).isNotBlank().isEqualTo(AccessibleBuildingParser.parse(a).id());
        assertThat(AccessibleBuildingParser.parse(a).id()).isNotEqualTo(AccessibleBuildingParser.parse(b).id());
    }

    @Test
    void buildsDisplayNameAddressAndMonitoringDateFromOfficialFields() throws Exception {
        var record = objectMapper.readTree("""
                {
                  "buildingId": "13",
                  "date": "2024-02-10T00:00:00.000",
                  "entityName": "Central city hospital",
                  "buildingName": "Main building",
                  "addressLocatorDesignator": "street",
                  "addressThoroughfare": "Oleksandra Hryboiedova",
                  "addressLocatorBuilding": "20"
                }
                """);

        var building = AccessibleBuildingParser.parse(record);

        assertThat(building.id()).isEqualTo("13");
        assertThat(building.name()).isEqualTo("Central city hospital — Main building");
        assertThat(building.address()).isEqualTo("street Oleksandra Hryboiedova 20");
        assertThat(building.monitoredAt()).hasToString("2024-02-10");
    }
}
