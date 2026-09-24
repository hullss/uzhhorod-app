package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_route_shape_points")
public class TransportRouteShapePoint {

    @EmbeddedId
    private TransportRouteShapePointId id;
    private double latitude;
    private double longitude;

    protected TransportRouteShapePoint() {
    }

    public TransportRouteShapePoint(UUID routeVariantId, int pointSequence, double latitude, double longitude) {
        this.id = new TransportRouteShapePointId(routeVariantId, pointSequence);
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public int getPointSequence() {
        return id.getPointSequence();
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }
}
