package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

final class FundDocumentValidator {
    static void validate(JsonNode body) {
        require(body.path("items").isArray() && body.path("items").size() <= 100);
        var ids = new HashSet<String>();
        for (var fund : body.path("items")) {
            for (var field : Map.of("id", 100, "title", 300, "description", 2000, "donationUrl", 2000, "verifiedAt", 10, "verificationSource", 2000).entrySet()) {
                var value = fund.path(field.getKey());
                require(value.isTextual() && !value.asText().isBlank() && value.asText().length() <= field.getValue());
            }
            require(ids.add(fund.path("id").asText().trim()));
            try {
                var u = URI.create(fund.path("donationUrl").asText()); var host = u.getHost();
                require("https".equalsIgnoreCase(u.getScheme()) && u.getUserInfo() == null && host != null && host.contains(".")
                    && !host.matches("(?i)^(localhost|127\\.|10\\.|192\\.168\\.|169\\.254\\.|172\\.(1[6-9]|2\\d|3[01])\\.).*"));
                var date = LocalDate.parse(fund.path("verifiedAt").asText());
                require(date.toString().equals(fund.path("verifiedAt").asText()) && !date.isAfter(LocalDate.now(ZoneId.of("Europe/Kyiv"))));
            } catch (IllegalArgumentException | java.time.DateTimeException ex) { require(false); }
        }
    }
    private static void require(boolean valid) {
        if (!valid) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid fund: check unique IDs, text, HTTPS donation URL and verification date");
    }
}
