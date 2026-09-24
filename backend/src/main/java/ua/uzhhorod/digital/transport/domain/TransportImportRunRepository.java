package ua.uzhhorod.digital.transport.domain;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransportImportRunRepository extends JpaRepository<TransportImportRun, UUID> {

    Optional<TransportImportRun> findFirstByStatusOrderByFinishedAtDesc(TransportImportStatus status);
}
