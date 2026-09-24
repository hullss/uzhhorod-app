package ua.uzhhorod.digital.transport.api;

import java.time.Instant;

public record TransportImportStatusResponse(
        boolean available,
        Instant completedAt,
        Integer importedRouteCount,
        Integer importedStopCount,
        Integer importedRouteStopCount,
        Integer importedRouteVariantCount) {
}
