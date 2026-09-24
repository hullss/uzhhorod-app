package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class TransportRouteStopId implements Serializable {

    private UUID routeId;
    private UUID stopId;

    protected TransportRouteStopId() {
    }

    public TransportRouteStopId(UUID routeId, UUID stopId) {
        this.routeId = routeId;
        this.stopId = stopId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof TransportRouteStopId other)) {
            return false;
        }
        return Objects.equals(routeId, other.routeId) && Objects.equals(stopId, other.stopId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(routeId, stopId);
    }
}
