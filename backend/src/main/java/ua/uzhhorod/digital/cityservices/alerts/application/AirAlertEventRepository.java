package ua.uzhhorod.digital.cityservices.alerts.application;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

interface AirAlertEventRepository extends JpaRepository<AirAlertEvent, java.util.UUID> {
    List<AirAlertEvent> findTop50ByOrderByOccurredAtDesc();
    Optional<AirAlertEvent> findTopByOrderByOccurredAtDesc();
}
