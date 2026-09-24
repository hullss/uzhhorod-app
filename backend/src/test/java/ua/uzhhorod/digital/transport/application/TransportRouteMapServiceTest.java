package ua.uzhhorod.digital.transport.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import ua.uzhhorod.digital.transport.domain.TransportRoute;
import ua.uzhhorod.digital.transport.domain.TransportRouteRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteShapePoint;
import ua.uzhhorod.digital.transport.domain.TransportRouteShapePointRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariant;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantStop;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportStop;
import ua.uzhhorod.digital.transport.domain.TransportStopRepository;

@DataJpaTest
@Import(TransportRouteMapService.class)
class TransportRouteMapServiceTest {

    @Autowired
    private TransportRouteMapService mapService;

    @Autowired
    private TransportRouteRepository routeRepository;

    @Autowired
    private TransportRouteVariantRepository variantRepository;

    @Autowired
    private TransportRouteVariantStopRepository variantStopRepository;

    @Autowired
    private TransportRouteShapePointRepository shapePointRepository;

    @Autowired
    private TransportStopRepository stopRepository;

    @Test
    void returnsRouteGeometryAndStops() {
        var route = routeRepository.save(new TransportRoute(
                UUID.randomUUID(), "route-18", "18", "Шумна — Доманинці", true));
        var variant = variantRepository.save(new TransportRouteVariant(
                UUID.randomUUID(), "route-18|0|Доманинці|shape-1", route.getId(), 0, "Доманинці"));
        var stop = stopRepository.save(new TransportStop(
                UUID.randomUUID(), "stop-1", "Петефі", 48.6201, 22.2967));
        variantStopRepository.save(new TransportRouteVariantStop(variant.getId(), stop.getId(), 1));
        shapePointRepository.save(new TransportRouteShapePoint(variant.getId(), 1, 48.6201, 22.2967));
        shapePointRepository.save(new TransportRouteShapePoint(variant.getId(), 2, 48.6301, 22.3067));

        var map = mapService.getMap(route.getId());

        assertThat(map.stops()).singleElement().satisfies(response -> assertThat(response.name()).isEqualTo("Петефі"));
        assertThat(map.variants()).singleElement().satisfies(response -> {
            assertThat(response.name()).isEqualTo("Доманинці");
            assertThat(response.shape()).hasSize(2);
        });
    }
}
