package ua.uzhhorod.digital.transport.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportRouteStopRepository extends JpaRepository<TransportRouteStop, TransportRouteStopId> {

    @Query("""
            select route from TransportRoute route
            join TransportRouteStop routeStop on routeStop.id.routeId = route.id
            where routeStop.id.stopId = :stopId
            order by route.routeNumber
            """)
    List<TransportRoute> findRoutesByStopId(UUID stopId);
}
