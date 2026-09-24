package ua.uzhhorod.digital.transport.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest
class TransportStopRepositoryTest {

    @Autowired
    private TransportRouteRepository routeRepository;

    @Autowired
    private TransportStopRepository stopRepository;

    @Autowired
    private TransportRouteStopRepository routeStopRepository;

    @Test
    void findsStopsForRoute() {
        var route = routeRepository.save(new TransportRoute(
                UUID.randomUUID(), "route-18", "18", "Тестовий маршрут", true));
        var stop = stopRepository.save(new TransportStop(
                UUID.randomUUID(), "stop-1", "Площа Шандора Петефі", 48.6201, 22.2967));
        routeStopRepository.save(new TransportRouteStop(route.getId(), stop.getId()));

        assertThat(stopRepository.findAllByRouteId(route.getId()))
                .extracting(TransportStop::getExternalId)
                .containsExactly("stop-1");
        assertThat(routeStopRepository.findRoutesByStopId(stop.getId()))
                .extracting(TransportRoute::getRouteNumber)
                .containsExactly("18");
    }
}
