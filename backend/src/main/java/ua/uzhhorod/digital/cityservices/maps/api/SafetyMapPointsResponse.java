package ua.uzhhorod.digital.cityservices.maps.api;

import java.time.Instant;
import java.util.List;

public record SafetyMapPointsResponse(
        Instant fetchedAt,
        boolean stale,
        List<SafetyMapPointResponse> points,
        String source) {
    public SafetyMapPointsResponse(Instant fetchedAt, boolean stale, List<SafetyMapPointResponse> points) {
        this(fetchedAt, stale, points, "source");
    }
}
