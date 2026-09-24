package ua.uzhhorod.digital.cityservices.accessibility.api;

import java.time.Instant;
import java.util.List;

public record AccessibleBuildingListResponse(
        Instant fetchedAt,
        boolean stale,
        List<AccessibleBuildingResponse> buildings) {
}
