package ua.uzhhorod.digital.transport.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

@DataJpaTest
class TransportRouteRepositoryTest {

    @Autowired
    private TransportRouteRepository routeRepository;

    @Test
    void findsRouteByOfficialExternalId() {
        var route = new TransportRoute(
                UUID.randomUUID(), "uzh-18", "18", "вул. Шумна — мкрн. Доманинці", true);
        routeRepository.save(route);

        var foundRoute = routeRepository.findByExternalId("uzh-18");

        assertThat(foundRoute)
                .hasValueSatisfying(found -> assertThat(found.getExternalId()).isEqualTo("uzh-18"));
    }
}
