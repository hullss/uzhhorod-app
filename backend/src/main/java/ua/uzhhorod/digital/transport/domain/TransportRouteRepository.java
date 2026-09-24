package ua.uzhhorod.digital.transport.domain;

import java.util.Optional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportRouteRepository extends JpaRepository<TransportRoute, UUID> {

    Optional<TransportRoute> findByExternalId(String externalId);

    List<TransportRoute> findAllByActiveTrueOrderByRouteNumberAsc();

    List<TransportRoute> findByActiveTrueAndRouteNumberContainingIgnoreCaseOrActiveTrueAndNameContainingIgnoreCase(
            String routeNumber,
            String name);
}
