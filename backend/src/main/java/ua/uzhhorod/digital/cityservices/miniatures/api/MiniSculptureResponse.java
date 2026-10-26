package ua.uzhhorod.digital.cityservices.miniatures.api;

import java.time.LocalDate;
import java.util.List;

public record MiniSculptureResponse(
        String id,
        String title,
        double latitude,
        double longitude,
        String address,
        String author,
        LocalDate installedAt,
        Integer installedYear,
        String summary,
        List<String> sourceUrls) {
}
