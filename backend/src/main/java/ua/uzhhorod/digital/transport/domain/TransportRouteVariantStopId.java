package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class TransportRouteVariantStopId implements Serializable {

    private UUID routeVariantId;
    private int stopSequence;

    protected TransportRouteVariantStopId() {
    }

    public TransportRouteVariantStopId(UUID routeVariantId, int stopSequence) {
        this.routeVariantId = routeVariantId;
        this.stopSequence = stopSequence;
    }

    public int getStopSequence() {
        return stopSequence;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof TransportRouteVariantStopId other)) {
            return false;
        }
        return Objects.equals(routeVariantId, other.routeVariantId) && stopSequence == other.stopSequence;
    }

    @Override
    public int hashCode() {
        return Objects.hash(routeVariantId, stopSequence);
    }
}
