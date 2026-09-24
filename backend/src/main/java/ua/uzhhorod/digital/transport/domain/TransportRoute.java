package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_routes")
public class TransportRoute {

    @Id
    private UUID id;

    @Column(name = "external_id", nullable = false, unique = true, length = 100)
    private String externalId;

    @Column(name = "route_number", nullable = false, length = 30)
    private String routeNumber;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private boolean active;

    protected TransportRoute() {
    }

    public TransportRoute(UUID id, String externalId, String routeNumber, String name, boolean active) {
        this.id = id;
        this.externalId = externalId;
        this.routeNumber = routeNumber;
        this.name = name;
        this.active = active;
    }

    public UUID getId() {
        return id;
    }

    public String getExternalId() {
        return externalId;
    }

    public String getRouteNumber() {
        return routeNumber;
    }

    public String getName() {
        return name;
    }

    public boolean isActive() {
        return active;
    }

    public void update(String routeNumber, String name, boolean active) {
        this.routeNumber = routeNumber;
        this.name = name;
        this.active = active;
    }
}
