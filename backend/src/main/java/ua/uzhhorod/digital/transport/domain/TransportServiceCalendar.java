package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.LocalDate;

@Entity
@Table(name = "transport_service_calendars")
public class TransportServiceCalendar {

    @Id
    private String serviceId;
    private boolean monday;
    private boolean tuesday;
    private boolean wednesday;
    private boolean thursday;
    private boolean friday;
    private boolean saturday;
    private boolean sunday;
    private LocalDate startDate;
    private LocalDate endDate;

    protected TransportServiceCalendar() {
    }

    public TransportServiceCalendar(
            String serviceId,
            boolean monday,
            boolean tuesday,
            boolean wednesday,
            boolean thursday,
            boolean friday,
            boolean saturday,
            boolean sunday,
            LocalDate startDate,
            LocalDate endDate) {
        this.serviceId = serviceId;
        this.monday = monday;
        this.tuesday = tuesday;
        this.wednesday = wednesday;
        this.thursday = thursday;
        this.friday = friday;
        this.saturday = saturday;
        this.sunday = sunday;
        this.startDate = startDate;
        this.endDate = endDate;
    }

    public String getServiceId() {
        return serviceId;
    }

    public boolean isActiveOn(LocalDate date) {
        if (date.isBefore(startDate) || date.isAfter(endDate)) {
            return false;
        }
        return switch (date.getDayOfWeek()) {
            case MONDAY -> monday;
            case TUESDAY -> tuesday;
            case WEDNESDAY -> wednesday;
            case THURSDAY -> thursday;
            case FRIDAY -> friday;
            case SATURDAY -> saturday;
            case SUNDAY -> sunday;
        };
    }
}
