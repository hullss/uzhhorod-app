package ua.uzhhorod.digital.transport.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "transport_import_runs")
public class TransportImportRun {

    @Id
    private UUID id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TransportImportStatus status;

    @Column(name = "source_url", nullable = false, length = 1000)
    private String sourceUrl;

    @Column(name = "imported_route_count")
    private Integer importedRouteCount;

    @Column(name = "imported_stop_count")
    private Integer importedStopCount;

    @Column(name = "imported_route_stop_count")
    private Integer importedRouteStopCount;

    @Column(name = "imported_route_variant_count")
    private Integer importedRouteVariantCount;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    protected TransportImportRun() {
    }

    public TransportImportRun(UUID id, Instant startedAt, String sourceUrl) {
        this.id = id;
        this.startedAt = startedAt;
        this.status = TransportImportStatus.RUNNING;
        this.sourceUrl = sourceUrl;
    }

    public void complete(int routeCount, int stopCount, int routeStopCount, int routeVariantCount) {
        status = TransportImportStatus.COMPLETED;
        finishedAt = Instant.now();
        importedRouteCount = routeCount;
        importedStopCount = stopCount;
        importedRouteStopCount = routeStopCount;
        importedRouteVariantCount = routeVariantCount;
        errorMessage = null;
    }

    public void fail(String message) {
        status = TransportImportStatus.FAILED;
        finishedAt = Instant.now();
        errorMessage = message.length() <= 1000 ? message : message.substring(0, 1000);
    }

    public UUID getId() {
        return id;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public TransportImportStatus getStatus() {
        return status;
    }

    public Integer getImportedRouteCount() {
        return importedRouteCount;
    }

    public Integer getImportedStopCount() {
        return importedStopCount;
    }

    public Integer getImportedRouteStopCount() {
        return importedRouteStopCount;
    }

    public Integer getImportedRouteVariantCount() {
        return importedRouteVariantCount;
    }

    public String getErrorMessage() {
        return errorMessage;
    }
}
