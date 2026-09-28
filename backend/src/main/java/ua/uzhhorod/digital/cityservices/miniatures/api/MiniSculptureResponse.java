package ua.uzhhorod.digital.cityservices.miniatures.api;

import java.time.LocalDate;

public record MiniSculptureResponse(
        String id,
        String title,
        double latitude,
        double longitude,
        String address,
        String author,
        LocalDate installedAt,
        String summary) {
}
