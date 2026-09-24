package ua.uzhhorod.digital.cityservices.accessibility.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class AccessibleBuildingParserTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

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
