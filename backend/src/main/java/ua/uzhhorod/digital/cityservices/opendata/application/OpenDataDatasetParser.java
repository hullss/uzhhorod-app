package ua.uzhhorod.digital.cityservices.opendata.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import ua.uzhhorod.digital.cityservices.opendata.api.OpenDataDatasetResponse;

final class OpenDataDatasetParser {

    private OpenDataDatasetParser() {
    }

    static OpenDataDatasetResponse parse(JsonNode dataset, String catalogUrl) {
        String slug = value(dataset, "name");
        String title = value(dataset, "title");
        String description = value(dataset, "notes").replaceAll("\\s+", " ");
        return new OpenDataDatasetResponse(
                title.isBlank() ? "Набір даних без назви" : title,
                description.isBlank() ? "Офіційний набір відкритих даних Ужгородської міської ради." : description,
                slug.isBlank() ? catalogUrl : catalogUrl + "/dataset/" + slug,
                parseDate(value(dataset, "metadata_modified")));
    }

    private static Instant parseDate(String value) {
        if (value.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(value);
        } catch (RuntimeException ignored) {
            try {
                return OffsetDateTime.parse(value).toInstant();
            } catch (RuntimeException ignoredAgain) {
                try {
                    return LocalDateTime.parse(value).toInstant(ZoneOffset.UTC);
                } catch (RuntimeException ignoredOnceMore) {
                    return null;
                }
            }
        }
    }

    private static String value(JsonNode dataset, String field) {
        JsonNode value = dataset.path(field);
        return value.isMissingNode() || value.isNull() ? "" : value.asText().trim();
    }
}
