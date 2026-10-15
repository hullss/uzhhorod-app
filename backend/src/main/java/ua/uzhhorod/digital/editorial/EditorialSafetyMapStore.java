package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Optional;
import org.springframework.stereotype.Service;
import ua.uzhhorod.digital.cityservices.maps.api.SafetyMapPointResponse;
import ua.uzhhorod.digital.cityservices.maps.api.SafetyMapPointsResponse;

/** Published lists win, including an intentionally empty list; no tile/feed cache involved. */
@Service
public class EditorialSafetyMapStore {
    private final EditorialDocumentRepository documents;
    private final ObjectMapper mapper;
    public EditorialSafetyMapStore(EditorialDocumentRepository documents, ObjectMapper mapper) {
        this.documents = documents; this.mapper = mapper;
    }
    public Optional<SafetyMapPointsResponse> read(String kind) {
        return documents.findById(kind).map(document -> {
            try {
                var body = mapper.readTree(document.getContent()); SafetyDocumentValidator.validate(body);
                var points = new ArrayList<SafetyMapPointResponse>();
                for (var item : body.path("items")) points.add(new SafetyMapPointResponse(
                    item.path("id").asText(), item.path("name").asText(), item.path("address").asText(),
                    item.path("latitude").asDouble(), item.path("longitude").asDouble(),
                    item.path("description").asText(null), item.path("sourceUrl").asText(null), item.path("verifiedAt").asText(null)));
                // Editorial publication is not a live guarantee of entrance availability.
                return new SafetyMapPointsResponse(document.getUpdatedAt(), true, points, "editorial");
            } catch (Exception error) { throw new IllegalStateException("Invalid published safety map", error); }
        });
    }
}
