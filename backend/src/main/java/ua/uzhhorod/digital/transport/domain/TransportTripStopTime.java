package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Column;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "transport_trip_stop_times")
public class TransportTripStopTime {

    @EmbeddedId
    private TransportTripStopTimeId id;

    @Column(name = "stop_id", nullable = false)
    private UUID stopId;

    @Column(name = "arrival_time_seconds")
    private Integer arrivalTimeSeconds;

    @Column(name = "departure_time_seconds")
    private Integer departureTimeSeconds;

    protected TransportTripStopTime() {
    }

    public TransportTripStopTime(
            UUID tripId,
            UUID stopId,
            int stopSequence,
            Integer arrivalTimeSeconds,
            Integer departureTimeSeconds) {
        this.id = new TransportTripStopTimeId(tripId, stopSequence);
        this.stopId = stopId;
        this.arrivalTimeSeconds = arrivalTimeSeconds;
        this.departureTimeSeconds = departureTimeSeconds;
    }

    public UUID getTripId() {
        return id.getTripId();
    }

    public UUID getStopId() {
        return stopId;
    }

    public Integer getArrivalTimeSeconds() {
        return arrivalTimeSeconds;
    }

    public Integer getDepartureTimeSeconds() {
        return departureTimeSeconds;
    }
}
