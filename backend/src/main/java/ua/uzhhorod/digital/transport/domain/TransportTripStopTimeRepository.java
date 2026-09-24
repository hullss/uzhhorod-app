package ua.uzhhorod.digital.transport.domain;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TransportTripStopTimeRepository
        extends JpaRepository<TransportTripStopTime, TransportTripStopTimeId> {

    @Query("""
            select stopTime from TransportTripStopTime stopTime
            join TransportTrip trip on trip.id = stopTime.id.tripId
            join TransportRouteVariant variant on variant.id = trip.routeVariantId
            where variant.routeId = :routeId and stopTime.stopId = :stopId
            order by stopTime.departureTimeSeconds
            """)
    List<TransportTripStopTime> findAllByRouteIdAndStopId(UUID routeId, UUID stopId);
}
