package ua.uzhhorod.digital.transport.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportStopRepository extends JpaRepository<TransportStop, UUID> {

    Optional<TransportStop> findByExternalId(String externalId);

    List<TransportStop> findByNameContainingIgnoreCaseOrderByNameAsc(String name);

    @Query("""
            select stop from TransportStop stop
            join TransportRouteStop routeStop on routeStop.id.stopId = stop.id
            where routeStop.id.routeId = :routeId
            order by stop.name
            """)
    List<TransportStop> findAllByRouteId(UUID routeId);
}
