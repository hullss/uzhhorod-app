package ua.uzhhorod.digital.cityservices.maps.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import ua.uzhhorod.digital.cityservices.maps.api.SafetyMapPointResponse;
import ua.uzhhorod.digital.cityservices.maps.api.SafetyMapPointsResponse;

/**
 * Keeps coordinate data separate from tiles: map tiles are only a picture, while
 * the app needs real, tappable locations. Shelters are refreshed from the city
 * geoportal; resilience points remain a small, previously published city list until the state
 * service exposes a public, unauthenticated feed for Uzhhorod.
 */
@Service
public class SafetyMapPointService {

    private static final Instant FALLBACK_UPDATED_AT = Instant.parse("2026-10-01T00:00:00Z");

    private final RestClient restClient;
    private final String sheltersSourceUrl;
    private final Duration cacheDuration;
    private final ManualMapPoints manualPoints;
    private volatile Snapshot sheltersSnapshot;

    public SafetyMapPointService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${city-services.maps.shelters-geojson-url}") String sheltersSourceUrl,
            @Value("${city-services.maps.shelters-cache-duration:PT30M}") Duration cacheDuration) {
        this.restClient = restClientBuilder.build();
        this.sheltersSourceUrl = sheltersSourceUrl;
        this.cacheDuration = cacheDuration;
        this.manualPoints = readManualPoints(objectMapper);
    }

    public SafetyMapPointsResponse getShelters() {
        Snapshot snapshot = currentShelterSnapshot();
        return new SafetyMapPointsResponse(snapshot.fetchedAt(), snapshot.stale(), snapshot.points());
    }

    public SafetyMapPointsResponse getResiliencePoints() {
        List<SafetyMapPointResponse> points = toResponses(manualPoints.resiliencePoints(), "resilience");
        return new SafetyMapPointsResponse(manualPoints.lastUpdatedAt(), true, points);
    }

    private Snapshot currentShelterSnapshot() {
        Snapshot cached = sheltersSnapshot;
        if (isFresh(cached)) {
            return cached;
        }
        synchronized (this) {
            cached = sheltersSnapshot;
            if (isFresh(cached)) {
                return cached;
            }
            try {
                JsonNode response = restClient.get().uri(sheltersSourceUrl).retrieve().body(JsonNode.class);
                List<SafetyMapPointResponse> points = mergeManualShelterPoints(parseGeoJson(response));
                if (points.isEmpty()) {
                    throw new IllegalStateException("The city geoportal did not return shelter coordinates");
                }
                Snapshot refreshed = new Snapshot(Instant.now(), false, points);
                sheltersSnapshot = refreshed;
                return refreshed;
            } catch (RuntimeException error) {
                if (cached != null) {
                    return new Snapshot(cached.fetchedAt(), true, cached.points());
                }
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Shelter map data is temporarily unavailable", error);
            }
        }
    }

    private boolean isFresh(Snapshot snapshot) {
        return snapshot != null && snapshot.fetchedAt().plus(cacheDuration).isAfter(Instant.now());
    }

    private List<SafetyMapPointResponse> parseGeoJson(JsonNode response) {
        if (response == null) {
            return List.of();
        }
        JsonNode features = response.path("features");
        if (!features.isArray() && response.isArray()) {
            features = response;
        }
        List<SafetyMapPointResponse> points = new ArrayList<>();
        int index = 1;
        for (JsonNode feature : features) {
            Coordinates coordinates = coordinates(feature.path("geometry"));
            if (coordinates == null || !isInUzhhorod(coordinates)) {
                continue;
            }
            Map<String, String> attributes = attributes(feature.path("properties"));
            String id = attribute(attributes, "id", "fid", "objectid", "globalid", "uuid");
            String name = attribute(attributes, "name", "title", "назва", "objectname", "type", "kind", "укриття");
            String address = address(attributes);
            points.add(point(
                    id.isBlank() ? "shelter-" + index : "shelter-" + id,
                    name.isBlank() ? "Укриття" : name,
                    address.isBlank() ? "Адреса не опублікована в геошарі" : address,
                    coordinates.latitude(), coordinates.longitude()));
            index++;
        }
        return points.stream()
                .sorted(Comparator.comparing(SafetyMapPointResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private ManualMapPoints readManualPoints(ObjectMapper objectMapper) {
        ClassPathResource resource = new ClassPathResource("safety-map-points.json");
        try (InputStream input = resource.getInputStream()) {
            ManualMapPoints raw = objectMapper.readValue(input, ManualMapPoints.class);
            return raw == null ? ManualMapPoints.empty() : raw.normalized();
        } catch (IOException error) {
            throw new IllegalStateException("Cannot read safety-map-points.json", error);
        }
    }

    private List<SafetyMapPointResponse> mergeManualShelterPoints(List<SafetyMapPointResponse> sourcePoints) {
        List<ManualMapPoint> manual = manualPoints.shelterPoints();
        if (manual.isEmpty()) {
            return sourcePoints;
        }

        List<SafetyMapPointResponse> result = new ArrayList<>();
        boolean[] consumed = new boolean[manual.size()];
        for (SafetyMapPointResponse sourcePoint : sourcePoints) {
            int matchIndex = matchingManualPoint(sourcePoint, manual);
            if (matchIndex < 0) {
                result.add(sourcePoint);
                continue;
            }
            consumed[matchIndex] = true;
            ManualMapPoint override = manual.get(matchIndex);
            result.add(point(
                    textOr(override.id(), sourcePoint.id()),
                    textOr(override.name(), sourcePoint.name()),
                    textOr(override.address(), sourcePoint.address()),
                    override.latitude(), override.longitude()));
        }
        for (int index = 0; index < manual.size(); index++) {
            if (!consumed[index]) {
                result.add(toResponse(manual.get(index), "shelter", index + 1));
            }
        }
        return result.stream()
                .sorted(Comparator.comparing(SafetyMapPointResponse::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private int matchingManualPoint(SafetyMapPointResponse sourcePoint, List<ManualMapPoint> manualPoints) {
        for (int index = 0; index < manualPoints.size(); index++) {
            ManualMapPoint point = manualPoints.get(index);
            if (!point.id().isBlank() && point.id().equals(sourcePoint.id())) {
                return index;
            }
            if (Math.abs(point.latitude() - sourcePoint.latitude()) < 0.00025
                    && Math.abs(point.longitude() - sourcePoint.longitude()) < 0.00025) {
                return index;
            }
        }
        return -1;
    }

    private List<SafetyMapPointResponse> toResponses(List<ManualMapPoint> points, String prefix) {
        List<SafetyMapPointResponse> response = new ArrayList<>();
        for (int index = 0; index < points.size(); index++) {
            response.add(toResponse(points.get(index), prefix, index + 1));
        }
        return response;
    }

    private SafetyMapPointResponse toResponse(ManualMapPoint point, String prefix, int index) {
        return point(
                point.id().isBlank() ? prefix + "-manual-" + index : point.id(),
                textOr(point.name(), prefix.equals("shelter") ? "Укриття" : "Пункт незламності"),
                textOr(point.address(), "Адреса уточнюється"),
                point.latitude(), point.longitude());
    }

    private String textOr(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private Coordinates coordinates(JsonNode geometry) {
        String type = geometry.path("type").asText("");
        JsonNode coordinates = geometry.path("coordinates");
        if ("Point".equalsIgnoreCase(type)) {
            return coordinatePair(coordinates);
        }
        if ("MultiPoint".equalsIgnoreCase(type) && coordinates.isArray() && !coordinates.isEmpty()) {
            return coordinatePair(coordinates.get(0));
        }
        if (("Polygon".equalsIgnoreCase(type) || "MultiPolygon".equalsIgnoreCase(type))) {
            List<Coordinates> vertices = new ArrayList<>();
            collectCoordinatePairs(coordinates, vertices);
            if (vertices.isEmpty()) {
                return null;
            }
            return new Coordinates(
                    vertices.stream().mapToDouble(Coordinates::latitude).average().orElseThrow(),
                    vertices.stream().mapToDouble(Coordinates::longitude).average().orElseThrow());
        }
        return null;
    }

    private void collectCoordinatePairs(JsonNode value, List<Coordinates> output) {
        if (coordinatePair(value) != null) {
            output.add(coordinatePair(value));
            return;
        }
        for (JsonNode child : value) {
            collectCoordinatePairs(child, output);
        }
    }

    private Coordinates coordinatePair(JsonNode node) {
        if (!node.isArray() || node.size() < 2 || !node.get(0).isNumber() || !node.get(1).isNumber()) {
            return null;
        }
        return new Coordinates(node.get(1).asDouble(), node.get(0).asDouble());
    }

    private boolean isInUzhhorod(Coordinates coordinates) {
        return coordinates.latitude() >= 48.56 && coordinates.latitude() <= 48.70
                && coordinates.longitude() >= 22.16 && coordinates.longitude() <= 22.42;
    }

    private Map<String, String> attributes(JsonNode properties) {
        Map<String, String> result = new LinkedHashMap<>();
        flattenAttributes(properties, "", result);
        return result;
    }

    private void flattenAttributes(JsonNode node, String path, Map<String, String> output) {
        if (node.isObject()) {
            node.fields().forEachRemaining(field -> flattenAttributes(
                    field.getValue(), path.isEmpty() ? field.getKey() : path + "." + field.getKey(), output));
            return;
        }
        if (node.isValueNode() && !node.isNull()) {
            String value = node.asText("").trim();
            if (!value.isBlank()) {
                output.put(normalize(path), value);
            }
        }
    }

    private String address(Map<String, String> attributes) {
        String direct = attribute(attributes,
                "address", "adres", "адреса", "location", "place", "locationaddress", "objectaddress", "розташування");
        if (!direct.isBlank()) {
            return direct;
        }
        String street = attribute(attributes, "street", "вулиця", "вул", "thoroughfare", "addressstreet", "назвавулиці");
        String house = attribute(attributes, "house", "building", "number", "будинок", "номер", "housenumber", "addressnumber");
        if (!street.isBlank()) {
            return house.isBlank() ? street : street + ", " + house;
        }
        return attributes.entrySet().stream()
                .filter(entry -> entry.getKey().contains("address") || entry.getKey().contains("adres")
                        || entry.getKey().contains("адрес") || entry.getKey().contains("street")
                        || entry.getKey().contains("вулиц") || entry.getKey().contains("розташ"))
                .map(Map.Entry::getValue)
                .filter(value -> !value.isBlank())
                .distinct()
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }

    private String attribute(Map<String, String> attributes, String... names) {
        for (String name : names) {
            String value = attributes.get(normalize(name));
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    private String normalize(String key) {
        return key.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-zа-яіїєґ0-9]", "");
    }

    private static SafetyMapPointResponse point(String id, String name, String address, double latitude, double longitude) {
        return new SafetyMapPointResponse(id, name, address, latitude, longitude);
    }

    private record Coordinates(double latitude, double longitude) {
    }

    private record Snapshot(Instant fetchedAt, boolean stale, List<SafetyMapPointResponse> points) {
    }

    private record ManualMapPoints(String updatedAt, List<ManualMapPoint> shelters, List<ManualMapPoint> resilience) {
        static ManualMapPoints empty() {
            return new ManualMapPoints(null, List.of(), List.of());
        }

        ManualMapPoints normalized() {
            return new ManualMapPoints(updatedAt,
                    usable(shelters), usable(resilience));
        }

        Instant lastUpdatedAt() {
            try {
                return updatedAt == null || updatedAt.isBlank()
                        ? FALLBACK_UPDATED_AT
                        : Instant.parse(updatedAt);
            } catch (RuntimeException ignored) {
                return FALLBACK_UPDATED_AT;
            }
        }

        List<ManualMapPoint> shelterPoints() {
            return shelters == null ? List.of() : shelters;
        }

        List<ManualMapPoint> resiliencePoints() {
            return resilience == null ? List.of() : resilience;
        }

        private static List<ManualMapPoint> usable(List<ManualMapPoint> points) {
            if (points == null) {
                return List.of();
            }
            return points.stream().filter(ManualMapPoint::hasCoordinates).toList();
        }
    }

    private record ManualMapPoint(String id, String name, String address, Double latitude, Double longitude) {
        ManualMapPoint {
            id = id == null ? "" : id.trim();
            name = name == null ? "" : name.trim();
            address = address == null ? "" : address.trim();
        }

        boolean hasCoordinates() {
            return latitude != null && longitude != null
                    && latitude >= 48.56 && latitude <= 48.70
                    && longitude >= 22.16 && longitude <= 22.42;
        }
    }
}
