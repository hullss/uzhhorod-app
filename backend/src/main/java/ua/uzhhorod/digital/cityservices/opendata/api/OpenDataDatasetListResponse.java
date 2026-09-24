package ua.uzhhorod.digital.cityservices.opendata.api;

import java.time.Instant;
import java.util.List;

public record OpenDataDatasetListResponse(
        Instant fetchedAt,
        boolean stale,
        List<OpenDataDatasetResponse> datasets) {
}
