package ua.uzhhorod.digital.cityservices.maps.api;

import java.time.Instant;
import java.util.List;

public record SafetyMapPointsResponse(
        Instant fetchedAt,
        boolean stale,
        List<SafetyMapPointResponse> points) {
}
