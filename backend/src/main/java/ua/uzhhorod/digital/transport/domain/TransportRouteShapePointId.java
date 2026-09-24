package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class TransportRouteShapePointId implements Serializable {

    private UUID routeVariantId;
    private int pointSequence;

    protected TransportRouteShapePointId() {
    }

    public TransportRouteShapePointId(UUID routeVariantId, int pointSequence) {
        this.routeVariantId = routeVariantId;
        this.pointSequence = pointSequence;
    }

    public UUID getRouteVariantId() {
        return routeVariantId;
    }

    public int getPointSequence() {
        return pointSequence;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof TransportRouteShapePointId other)) {
            return false;
        }
        return Objects.equals(routeVariantId, other.routeVariantId) && pointSequence == other.pointSequence;
    }

    @Override
    public int hashCode() {
        return Objects.hash(routeVariantId, pointSequence);
    }
}
