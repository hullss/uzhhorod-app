package ua.uzhhorod.digital.cityservices.news.api;

import java.time.Instant;
import java.util.List;

public record OfficialNewsListResponse(
        Instant fetchedAt,
        boolean stale,
        List<OfficialNewsItemResponse> items) {
}
