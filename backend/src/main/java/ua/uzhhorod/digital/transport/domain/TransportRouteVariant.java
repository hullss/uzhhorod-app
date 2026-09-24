package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_route_variants")
public class TransportRouteVariant {

    @Id
    private UUID id;

    @Column(name = "external_id", nullable = false, unique = true, length = 255)
    private String externalId;

    @Column(name = "route_id", nullable = false)
    private UUID routeId;

    @Column(name = "direction_id")
    private Integer directionId;

    @Column(nullable = false)
    private String name;

    protected TransportRouteVariant() {
    }

    public TransportRouteVariant(UUID id, String externalId, UUID routeId, Integer directionId, String name) {
        this.id = id;
        this.externalId = externalId;
        this.routeId = routeId;
        this.directionId = directionId;
        this.name = name;
    }

    public UUID getId() {
        return id;
    }

    public Integer getDirectionId() {
        return directionId;
    }

    public String getName() {
        return name;
    }

    public void update(String name) {
        this.name = name;
    }
}
