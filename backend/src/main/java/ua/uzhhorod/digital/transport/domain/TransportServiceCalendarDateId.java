package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Embeddable;
import java.io.Serializable;
import java.time.LocalDate;
import java.util.Objects;

@Embeddable
public class TransportServiceCalendarDateId implements Serializable {

    private String serviceId;
    private LocalDate serviceDate;

    protected TransportServiceCalendarDateId() {
    }

    public TransportServiceCalendarDateId(String serviceId, LocalDate serviceDate) {
        this.serviceId = serviceId;
        this.serviceDate = serviceDate;
    }

    public String getServiceId() {
        return serviceId;
    }

    public LocalDate getServiceDate() {
        return serviceDate;
    }

    @Override
    public boolean equals(Object object) {
        if (this == object) {
            return true;
        }
        if (!(object instanceof TransportServiceCalendarDateId other)) {
            return false;
        }
        return Objects.equals(serviceId, other.serviceId) && Objects.equals(serviceDate, other.serviceDate);
    }

    @Override
    public int hashCode() {
        return Objects.hash(serviceId, serviceDate);
    }
}
