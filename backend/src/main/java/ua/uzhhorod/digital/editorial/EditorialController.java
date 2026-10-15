package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import ua.uzhhorod.digital.cityservices.maps.application.SafetyMapPointService;

@RestController
@RequestMapping("/api")
public class EditorialController {
    private static final Set<String> ALLOWED_DOCUMENTS = Set.of("events", "defender-funds", "shelters", "resilience");
    private final EditorialDocumentRepository documents;
    private final ObjectMapper objectMapper;
    private final String adminKey;
    private final SafetyMapPointService safetyMaps;

    public EditorialController(EditorialDocumentRepository documents, ObjectMapper objectMapper, SafetyMapPointService safetyMaps,
            @Value("${editorial.admin-key:}") String adminKey) {
        this.documents = documents;
        this.objectMapper = objectMapper;
        this.adminKey = adminKey;
        this.safetyMaps = safetyMaps;
    }

    @GetMapping("/editorial/{documentKey}")
    public JsonNode publicDocument(@PathVariable String documentKey) {
        requireKnownDocument(documentKey);
        return documents.findById(documentKey)
                .map(document -> read(document.getContent()))
                .orElseGet(() -> {
                    if (documentKey.equals("events")) return defaultEvents();
                    if (documentKey.equals("shelters") || documentKey.equals("resilience")) {
                        ua.uzhhorod.digital.cityservices.maps.api.SafetyMapPointsResponse response;
                        try {
                            response = documentKey.equals("shelters") ? safetyMaps.getShelters() : safetyMaps.getResiliencePoints();
                        } catch (ResponseStatusException error) {
                            if (error.getStatusCode().value() == 503) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Map source import is temporarily unavailable", error);
                            throw error;
                        }
                        var result = objectMapper.createObjectNode();
                        var items = result.putArray("items");
                        for (var point : response.points()) {
                            var item = items.addObject();
                            item.put("id", point.id()); item.put("name", point.name()); item.put("address", point.address());
                            item.put("latitude", point.latitude()); item.put("longitude", point.longitude());
                        }
                        return result;
                    }
                    var empty = objectMapper.createObjectNode();
                    empty.putArray("items");
                    return empty;
                });
    }

    @GetMapping("/admin/editorial/{documentKey}")
    public JsonNode adminDocument(@PathVariable String documentKey, @RequestHeader(value = "X-Admin-Key", required = false) String suppliedKey) {
        requireAdmin(suppliedKey);
        return publicDocument(documentKey);
    }

    @PutMapping("/admin/editorial/{documentKey}")
    public JsonNode saveDocument(@PathVariable String documentKey, @RequestHeader(value = "X-Admin-Key", required = false) String suppliedKey,
            @RequestBody JsonNode body) {
        requireAdmin(suppliedKey);
        requireKnownDocument(documentKey);
        if (!body.isObject() || !body.path("items").isArray()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Document must be an object with an items array");
        }
        if (documentKey.equals("events")) EventDocumentValidator.validate(body);
        if (documentKey.equals("defender-funds")) FundDocumentValidator.validate(body);
        if (documentKey.equals("shelters") || documentKey.equals("resilience")) SafetyDocumentValidator.validate(body);
        String content;
        try {
            content = objectMapper.writeValueAsString(body);
        } catch (Exception error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Document is not valid JSON");
        }
        EditorialDocument document = documents.findById(documentKey).orElseGet(() -> new EditorialDocument(documentKey, content));
        document.update(content);
        documents.save(document);
        return read(content);
    }

    private JsonNode defaultEvents() {
        // A stored document, including an intentionally empty list, always wins.
        // Never overwrite an editor's data or populate the database from this fallback.
        try (var stream = new ClassPathResource("editorial/events.json").getInputStream()) {
            return objectMapper.readTree(stream);
        } catch (Exception error) {
            throw new IllegalStateException("Packaged event catalogue is invalid", error);
        }
    }

    private void requireKnownDocument(String key) {
        if (!ALLOWED_DOCUMENTS.contains(key)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown editorial document");
    }

    private void requireAdmin(String suppliedKey) {
        if (adminKey.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Editorial admin is not configured");
        if (!adminKey.equals(suppliedKey)) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid admin key");
    }

    private JsonNode read(String content) {
        try {
            return objectMapper.readTree(content);
        } catch (Exception error) {
            throw new IllegalStateException("Stored editorial document is invalid", error);
        }
    }
}
