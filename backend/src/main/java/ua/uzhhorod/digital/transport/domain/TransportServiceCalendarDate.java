package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.LocalDate;

@Entity
@Table(name = "transport_service_calendar_dates")
public class TransportServiceCalendarDate {

    @EmbeddedId
    private TransportServiceCalendarDateId id;
    private int exceptionType;

    protected TransportServiceCalendarDate() {
    }

    public TransportServiceCalendarDate(String serviceId, LocalDate serviceDate, int exceptionType) {
        this.id = new TransportServiceCalendarDateId(serviceId, serviceDate);
        this.exceptionType = exceptionType;
    }

    public String getServiceId() {
        return id.getServiceId();
    }

    public LocalDate getServiceDate() {
        return id.getServiceDate();
    }

    public int getExceptionType() {
        return exceptionType;
    }
}
