package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

@Embeddable
public class TransportTripStopTimeId implements Serializable {

    private UUID tripId;
    private int stopSequence;

    protected TransportTripStopTimeId() {
    }

    public TransportTripStopTimeId(UUID tripId, int stopSequence) {
        this.tripId = tripId;
        this.stopSequence = stopSequence;
    }

    public UUID getTripId() {
        return tripId;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof TransportTripStopTimeId other)) {
            return false;
        }
        return Objects.equals(tripId, other.tripId) && stopSequence == other.stopSequence;
    }

    @Override
    public int hashCode() {
        return Objects.hash(tripId, stopSequence);
    }
}
