package ua.uzhhorod.digital.transport.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import ua.uzhhorod.digital.transport.domain.TransportRoute;
import ua.uzhhorod.digital.transport.domain.TransportRouteRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariant;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendar;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarDate;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarDateRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarRepository;
import ua.uzhhorod.digital.transport.domain.TransportStop;
import ua.uzhhorod.digital.transport.domain.TransportStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportTrip;
import ua.uzhhorod.digital.transport.domain.TransportTripRepository;
import ua.uzhhorod.digital.transport.domain.TransportTripStopTime;
import ua.uzhhorod.digital.transport.domain.TransportTripStopTimeRepository;

@DataJpaTest
@Import(TransportScheduleService.class)
class TransportScheduleServiceTest {

    @Autowired
    private TransportScheduleService scheduleService;

    @Autowired
    private TransportRouteRepository routeRepository;

    @Autowired
    private TransportRouteVariantRepository variantRepository;

    @Autowired
    private TransportStopRepository stopRepository;

    @Autowired
    private TransportTripRepository tripRepository;

    @Autowired
    private TransportTripStopTimeRepository tripStopTimeRepository;

    @Autowired
    private TransportServiceCalendarRepository calendarRepository;

    @Autowired
    private TransportServiceCalendarDateRepository calendarDateRepository;

    @Test
    void returnsOnlyTripsActiveOnRequestedDateAndAppliesCalendarException() {
        var route = routeRepository.save(new TransportRoute(
                UUID.randomUUID(), "route-18", "18", "Шумна — Доманинці", true));
        var variant = variantRepository.save(new TransportRouteVariant(
                UUID.randomUUID(), "route-18|0|Доманинці|shape-1", route.getId(), 0, "Доманинці"));
        var stop = stopRepository.save(new TransportStop(
                UUID.randomUUID(), "stop-1", "Петефі", 48.62, 22.29));
        var trip = tripRepository.save(new TransportTrip(
                UUID.randomUUID(), "trip-1", variant.getId(), "weekday"));
        tripStopTimeRepository.save(new TransportTripStopTime(
                trip.getId(), stop.getId(), 1, 8 * 3600 + 15 * 60, 8 * 3600 + 15 * 60));
        calendarRepository.save(new TransportServiceCalendar(
                "weekday", true, true, true, true, true, false, false,
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31)));

        assertThat(scheduleService.getDepartures(route.getId(), stop.getId(), LocalDate.of(2026, 9, 27)))
                .isEmpty();

        calendarDateRepository.save(new TransportServiceCalendarDate(
                "weekday", LocalDate.of(2026, 9, 27), 1));

        assertThat(scheduleService.getDepartures(route.getId(), stop.getId(), LocalDate.of(2026, 9, 27)))
                .singleElement()
                .satisfies(departure -> {
                    assertThat(departure.departureTime()).isEqualTo("08:15");
                    assertThat(departure.destination()).isEqualTo("Доманинці");
                });
    }
}
