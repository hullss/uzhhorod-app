package ua.uzhhorod.digital.cityservices.opendata.api;

import java.time.Instant;

public record OpenDataDatasetResponse(
        String title,
        String description,
        String sourceUrl,
        Instant updatedAt) {
}
