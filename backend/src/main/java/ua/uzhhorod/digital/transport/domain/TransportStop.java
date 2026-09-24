package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_stops")
public class TransportStop {

    @Id
    private UUID id;

    @Column(name = "external_id", nullable = false, unique = true, length = 100)
    private String externalId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    protected TransportStop() {
    }

    public TransportStop(UUID id, String externalId, String name, double latitude, double longitude) {
        this.id = id;
        this.externalId = externalId;
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public UUID getId() {
        return id;
    }

    public String getExternalId() {
        return externalId;
    }

    public String getName() {
        return name;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void update(String name, double latitude, double longitude) {
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
    }
}
