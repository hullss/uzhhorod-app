package ua.uzhhorod.digital.transport.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

class TransportVehiclePositionServiceTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void mapsActiveDozorVehiclesToPublicRouteMarkers() throws Exception {
        var routesSource = objectMapper.readTree("""
                {
                  "data": [
                    {
                      "id": 1136,
                      "sNm": "2"
                    }
                  ]
                }
                """);
        var vehiclesSource = objectMapper.readTree("""
                {
                  "data": [
                    {
                      "rId": 1136,
                      "dvs": [
                        { "id": 5556, "loc": { "lat": 48.615415, "lng": 22.276235 }, "spd": 24, "azi": 90, "gNb": "not-public" },
                        { "id": 5151, "loc": { "lat": 50.254650, "lng": 28.658666 }, "spd": 0 }
                      ]
                    }
                  ]
                }
                """);

        var routes = TransportVehiclePositionService.parseRoutes(routesSource);
        var vehicles = TransportVehiclePositionService.parseVehicles(
                vehiclesSource, routes, java.time.Instant.parse("2026-09-28T12:00:00Z"));

        assertThat(vehicles).singleElement().satisfies(vehicle -> {
            assertThat(vehicle.id()).isEqualTo("vehicle-1136-5556");
            assertThat(vehicle.routeNumber()).isEqualTo("2");
            assertThat(vehicle.latitude()).isEqualTo(48.615415);
            assertThat(vehicle.longitude()).isEqualTo(22.276235);
            assertThat(vehicle.speedKph()).isEqualTo(24);
            assertThat(vehicle.headingDegrees()).isEqualTo(90);
            assertThat(vehicle.measuredAt()).hasToString("2026-09-28T12:00:00Z");
        });
    }
}
