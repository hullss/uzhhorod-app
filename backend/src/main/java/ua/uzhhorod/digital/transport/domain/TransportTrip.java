package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_trips")
public class TransportTrip {

    @Id
    private UUID id;

    @Column(name = "external_id", nullable = false, unique = true, length = 255)
    private String externalId;

    @Column(name = "route_variant_id", nullable = false)
    private UUID routeVariantId;

    @Column(name = "service_id", nullable = false, length = 255)
    private String serviceId;

    protected TransportTrip() {
    }

    public TransportTrip(UUID id, String externalId, UUID routeVariantId, String serviceId) {
        this.id = id;
        this.externalId = externalId;
        this.routeVariantId = routeVariantId;
        this.serviceId = serviceId;
    }

    public UUID getId() {
        return id;
    }

    public UUID getRouteVariantId() {
        return routeVariantId;
    }

    public String getServiceId() {
        return serviceId;
    }
}
