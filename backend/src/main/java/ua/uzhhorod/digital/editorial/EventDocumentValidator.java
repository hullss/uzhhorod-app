package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class EventDocumentValidator {
    private EventDocumentValidator() {}
    static void validate(JsonNode body) {
        var items = body.path("items");
        require(items.isArray() && items.size() <= 500, "items must contain at most 500 events");
        var ids = new HashSet<String>();
        for (var event : items) {
            require(event.isObject(), "Every event must be an object");
            for (String key : Set.of("id", "title", "venue", "description", "date", "verifiedAt", "sourceUrl", "category")) {
                require(event.path(key).isTextual() && !event.path(key).asText().isBlank(), key + " is required");
            }
            require(event.path("id").asText().length() <= 100 && ids.add(event.path("id").asText().trim()), "Invalid or duplicate event id");
            require(event.path("title").asText().length() <= 300 && event.path("venue").asText().length() <= 300
                && event.path("description").asText().length() <= 6000, "Event text is too long");
            require(date(event.path("date").asText()) && date(event.path("verifiedAt").asText()), "Dates must be valid YYYY-MM-DD including the year");
            require(Set.of("Концерти", "Театр", "Виставки", "Лекції та зустрічі", "Майстер-класи", "Спорт", "Для дітей", "Фестивалі", "Інше").contains(event.path("category").asText()), "Unknown category");
            require(url(event.path("sourceUrl").asText()), "sourceUrl must be a public HTTPS URL");
            if (event.has("time")) require(event.path("time").isTextual() && event.path("time").asText().matches("([01]\\d|2[0-3]):[0-5]\\d"), "time must be HH:mm");
            if (event.has("posterUrl")) require(event.path("posterUrl").isTextual() && url(event.path("posterUrl").asText()), "Invalid posterUrl");
            for (String key : Set.of("address", "organizer")) {
                if (event.has(key)) require(event.path(key).isTextual() && !event.path(key).asText().isBlank()
                    && event.path(key).asText().length() <= (key.equals("address") ? 500 : 300), "Invalid " + key);
            }
        }
    }
    private static boolean date(String value) {
        try { return value.matches("\\d{4}-\\d{2}-\\d{2}") && LocalDate.parse(value).toString().equals(value); }
        catch (Exception ignored) { return false; }
    }
    private static boolean url(String value) {
        try {
            var uri = URI.create(value); var host = uri.getHost();
            return "https".equalsIgnoreCase(uri.getScheme()) && uri.getUserInfo() == null && host != null && host.contains(".")
                && !host.matches("(?i)^(localhost|127\\.|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2\\d|3[01])\\.).*");
        } catch (Exception ignored) { return false; }
    }
    private static void require(boolean condition, String message) {
        if (!condition) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
