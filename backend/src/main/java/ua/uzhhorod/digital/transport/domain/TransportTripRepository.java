package ua.uzhhorod.digital.transport.domain;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportTripRepository extends JpaRepository<TransportTrip, UUID> {
}
