package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_route_stops")
public class TransportRouteStop {

    @EmbeddedId
    private TransportRouteStopId id;

    protected TransportRouteStop() {
    }

    public TransportRouteStop(UUID routeId, UUID stopId) {
        this.id = new TransportRouteStopId(routeId, stopId);
    }
}
