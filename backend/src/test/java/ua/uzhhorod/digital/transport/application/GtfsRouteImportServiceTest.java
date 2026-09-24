package ua.uzhhorod.digital.transport.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import ua.uzhhorod.digital.transport.domain.TransportRouteRepository;
import ua.uzhhorod.digital.transport.domain.TransportRoute;
import ua.uzhhorod.digital.transport.domain.TransportImportRunRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteShapePointRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarDateRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarRepository;
import ua.uzhhorod.digital.transport.domain.TransportStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportTripRepository;
import ua.uzhhorod.digital.transport.domain.TransportTripStopTimeRepository;

@DataJpaTest
class GtfsRouteImportServiceTest {

    @Autowired
    private TransportRouteRepository routeRepository;

    @Autowired
    private TransportImportRunRepository importRunRepository;

    @Autowired
    private TransportStopRepository stopRepository;

    @Autowired
    private TransportRouteStopRepository routeStopRepository;

    @Autowired
    private TransportRouteVariantRepository routeVariantRepository;

    @Autowired
    private TransportRouteVariantStopRepository routeVariantStopRepository;

    @Autowired
    private TransportRouteShapePointRepository routeShapePointRepository;

    @Autowired
    private TransportTripRepository tripRepository;

    @Autowired
    private TransportTripStopTimeRepository tripStopTimeRepository;

    @Autowired
    private TransportServiceCalendarRepository calendarRepository;

    @Autowired
    private TransportServiceCalendarDateRepository calendarDateRepository;

    @Test
    void importsRoutesFromGtfsArchive() throws IOException {
        routeRepository.save(new TransportRoute(
                UUID.randomUUID(), "removed-route", "99", "Старий маршрут", true));
        var importer = new GtfsRouteImportService(
                routeRepository,
                stopRepository,
                routeStopRepository,
                routeVariantRepository,
                routeVariantStopRepository,
                routeShapePointRepository,
                tripRepository,
                tripStopTimeRepository,
                calendarRepository,
                calendarDateRepository,
                new TransportImportRunService(importRunRepository),
                URI.create("https://example.invalid/feed.zip").toString());

        var result = importer.importTransportDataFromArchive(createGtfsArchive());

        assertThat(result.importedRouteCount()).isEqualTo(1);
        assertThat(result.importedStopCount()).isEqualTo(1);
        assertThat(result.importedRouteStopCount()).isEqualTo(1);
        assertThat(result.importedRouteVariantCount()).isEqualTo(1);
        assertThat(routeRepository.findByExternalId("route-18"))
                .hasValueSatisfying(route -> {
                    assertThat(route.getRouteNumber()).isEqualTo("18");
                    assertThat(route.getName()).isEqualTo("вул. Шумна — мкрн. Доманинці");
                });
        assertThat(routeRepository.findByExternalId("removed-route"))
                .hasValueSatisfying(route -> assertThat(route.isActive()).isFalse());
        assertThat(stopRepository.findByExternalId("stop-1"))
                .hasValueSatisfying(stop -> assertThat(stop.getName()).isEqualTo("Площа Шандора Петефі"));
        assertThat(tripRepository.count()).isEqualTo(1);
        assertThat(tripStopTimeRepository.count()).isEqualTo(1);
        assertThat(routeShapePointRepository.count()).isEqualTo(2);
        assertThat(calendarRepository.findById("weekday"))
                .hasValueSatisfying(calendar -> assertThat(calendar.isActiveOn(java.time.LocalDate.of(2026, 9, 24))).isTrue());
    }

    private byte[] createGtfsArchive() throws IOException {
        try (var bytes = new ByteArrayOutputStream(); var zip = new ZipOutputStream(bytes)) {
            writeEntry(zip, "routes.txt", "route_id,route_short_name,route_long_name\n"
                    + "route-18,18,вул. Шумна — мкрн. Доманинці\n");
            writeEntry(zip, "stops.txt", "stop_id,stop_name,stop_lat,stop_lon\n"
                    + "stop-1,Площа Шандора Петефі,48.6201,22.2967\n");
            writeEntry(zip, "trips.txt", "route_id,service_id,trip_id,direction_id,trip_headsign,shape_id\n"
                    + "route-18,weekday,trip-1,0,Доманинці,shape-1\n");
            writeEntry(zip, "stop_times.txt", "trip_id,arrival_time,departure_time,stop_id,stop_sequence\n"
                    + "trip-1,08:15:00,08:15:00,stop-1,1\n");
            writeEntry(zip, "calendar.txt", "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\n"
                    + "weekday,1,1,1,1,1,0,0,20260101,20261231\n");
            writeEntry(zip, "shapes.txt", "shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\n"
                    + "shape-1,48.6201,22.2967,1\n"
                    + "shape-1,48.6301,22.3067,2\n");
            zip.finish();
            return bytes.toByteArray();
        }
    }

    private void writeEntry(ZipOutputStream zip, String name, String contents) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(contents.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
}
