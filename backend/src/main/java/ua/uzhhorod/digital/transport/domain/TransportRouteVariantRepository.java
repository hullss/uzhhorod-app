package ua.uzhhorod.digital.transport.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportRouteVariantRepository extends JpaRepository<TransportRouteVariant, UUID> {

    Optional<TransportRouteVariant> findByExternalId(String externalId);

    List<TransportRouteVariant> findAllByRouteIdOrderByDirectionIdAscNameAsc(UUID routeId);
}
