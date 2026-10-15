package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class SafetyDocumentValidator {
    private SafetyDocumentValidator() {}
    static void validate(JsonNode body) {
        var items = body.path("items");
        require(body.isObject() && items.isArray() && items.size() <= 5000, "Expected at most 5000 map points");
        var ids = new HashSet<String>();
        for (var point : items) {
            require(point.isObject(), "Point must be an object");
            text(point, "id", 100, true); text(point, "name", 300, true); text(point, "address", 500, true);
            require(ids.add(point.path("id").asText().trim()), "Duplicate point id");
            coordinate(point, "latitude", 48.56, 48.70); coordinate(point, "longitude", 22.16, 22.42);
            text(point, "description", 2000, false);
            text(point, "sourceUrl", 2000, false);
            if (point.has("sourceUrl")) {
                try {
                    var uri = URI.create(point.path("sourceUrl").asText()); var host = uri.getHost();
                    require("https".equalsIgnoreCase(uri.getScheme()) && uri.getUserInfo() == null && host != null && host.contains(".")
                        && !host.matches("(?i)^(localhost|127\\.|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2\\d|3[01])\\.).*"), "Expected a public HTTPS source URL");
                } catch (IllegalArgumentException error) { require(false, "Invalid source URL"); }
            }
            if (point.has("verifiedAt")) {
                try {
                    String value = point.path("verifiedAt").asText(); var date = LocalDate.parse(value);
                    require(point.path("verifiedAt").isTextual() && value.matches("\\d{4}-\\d{2}-\\d{2}") && date.toString().equals(value)
                        && !date.isAfter(LocalDate.now(ZoneId.of("Europe/Kyiv"))), "Invalid verification date");
                } catch (java.time.DateTimeException error) { require(false, "Invalid verification date"); }
            }
        }
    }
    private static void text(JsonNode point, String key, int limit, boolean required) {
        if (!required && !point.has(key)) return;
        require(point.path(key).isTextual() && !point.path(key).asText().isBlank() && point.path(key).asText().length() <= limit, "Invalid " + key);
    }
    private static void coordinate(JsonNode point, String key, double min, double max) {
        var value = point.path(key);
        require(value.isNumber() && Double.isFinite(value.asDouble()) && value.asDouble() >= min && value.asDouble() <= max, "Coordinates must be within Uzhhorod");
    }
    private static void require(boolean condition, String message) {
        if (!condition) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
