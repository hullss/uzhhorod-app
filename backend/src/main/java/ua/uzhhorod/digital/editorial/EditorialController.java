package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
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

@RestController
@RequestMapping("/api")
public class EditorialController {
    private static final Set<String> ALLOWED_DOCUMENTS = Set.of("events", "defender-funds");
    private final EditorialDocumentRepository documents;
    private final ObjectMapper objectMapper;
    private final String adminKey;

    public EditorialController(EditorialDocumentRepository documents, ObjectMapper objectMapper,
            @Value("${editorial.admin-key:}") String adminKey) {
        this.documents = documents;
        this.objectMapper = objectMapper;
        this.adminKey = adminKey;
    }

    @GetMapping("/editorial/{documentKey}")
    public JsonNode publicDocument(@PathVariable String documentKey) {
        requireKnownDocument(documentKey);
        return documents.findById(documentKey)
                .map(document -> read(document.getContent()))
                .orElseGet(() -> {
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
