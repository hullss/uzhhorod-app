package ua.uzhhorod.digital.transport.application;

import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import ua.uzhhorod.digital.transport.domain.TransportImportRun;
import ua.uzhhorod.digital.transport.domain.TransportImportRunRepository;
import ua.uzhhorod.digital.transport.domain.TransportImportStatus;

@Service
public class TransportImportRunService {

    private final TransportImportRunRepository repository;

    public TransportImportRunService(TransportImportRunRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UUID start(String sourceUrl) {
        var run = repository.save(new TransportImportRun(UUID.randomUUID(), Instant.now(), sourceUrl));
        return run.getId();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(UUID runId, GtfsRouteImportService.GtfsImportResult result) {
        repository.findById(runId).orElseThrow().complete(
                result.importedRouteCount(),
                result.importedStopCount(),
                result.importedRouteStopCount(),
                result.importedRouteVariantCount());
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(UUID runId, Exception exception) {
        repository.findById(runId).orElseThrow().fail(
                exception.getMessage() == null ? exception.getClass().getSimpleName() : exception.getMessage());
    }

    @Transactional(readOnly = true)
    public java.util.Optional<TransportImportRun> getLatestCompleted() {
        return repository.findFirstByStatusOrderByFinishedAtDesc(TransportImportStatus.COMPLETED);
    }
}
