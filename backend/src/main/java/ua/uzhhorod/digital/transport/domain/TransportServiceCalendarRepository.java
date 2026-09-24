package ua.uzhhorod.digital.transport.domain;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportServiceCalendarRepository extends JpaRepository<TransportServiceCalendar, String> {

    List<TransportServiceCalendar> findAllByServiceIdIn(Collection<String> serviceIds);
}
