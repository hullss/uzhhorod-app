package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_route_variant_stops")
public class TransportRouteVariantStop {

    @EmbeddedId
    private TransportRouteVariantStopId id;

    private UUID stopId;

    protected TransportRouteVariantStop() {
    }

    public TransportRouteVariantStop(UUID routeVariantId, UUID stopId, int stopSequence) {
        this.id = new TransportRouteVariantStopId(routeVariantId, stopSequence);
        this.stopId = stopId;
    }

    public UUID getStopId() {
        return stopId;
    }

    public int getStopSequence() {
        return id.getStopSequence();
    }
}
