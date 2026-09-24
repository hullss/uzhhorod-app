package ua.uzhhorod.digital.transport.domain;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TransportServiceCalendarDateRepository
        extends JpaRepository<TransportServiceCalendarDate, TransportServiceCalendarDateId> {

    @Query("""
            select calendarDate from TransportServiceCalendarDate calendarDate
            where calendarDate.id.serviceDate = :serviceDate
            and calendarDate.id.serviceId in :serviceIds
            """)
    List<TransportServiceCalendarDate> findAllForDateAndServiceIds(
            LocalDate serviceDate, Collection<String> serviceIds);
}
