package ua.uzhhorod.digital.cityservices.accessibility.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import ua.uzhhorod.digital.cityservices.accessibility.api.AccessibleBuildingListResponse;
import ua.uzhhorod.digital.cityservices.accessibility.api.AccessibleBuildingResponse;

@Service
public class AccessibleBuildingService {

    private final RestClient restClient;
    private final String sourceUrl;
    private final Duration cacheDuration;
    private volatile Snapshot snapshot;

    public AccessibleBuildingService(
            RestClient.Builder restClientBuilder,
            @Value("${city-services.accessibility.datastore-url}") String sourceUrl,
            @Value("${city-services.accessibility.cache-duration:PT6H}") Duration cacheDuration) {
        this.restClient = restClientBuilder.build();
        this.sourceUrl = sourceUrl;
        this.cacheDuration = cacheDuration;
    }

    public AccessibleBuildingListResponse getBuildings(String query) {
        Snapshot current = currentSnapshot();
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        List<AccessibleBuildingResponse> buildings = current.buildings().stream()
                .filter(building -> normalizedQuery.isEmpty() || matches(building, normalizedQuery))
                .toList();
        return new AccessibleBuildingListResponse(current.fetchedAt(), current.stale(), buildings);
    }

    private Snapshot currentSnapshot() {
        Snapshot cached = snapshot;
        if (cached != null && cached.fetchedAt().plus(cacheDuration).isAfter(Instant.now())) {
            return cached;
        }

        synchronized (this) {
            cached = snapshot;
            if (cached != null && cached.fetchedAt().plus(cacheDuration).isAfter(Instant.now())) {
                return cached;
            }
            try {
                JsonNode response = restClient.get().uri(sourceUrl).retrieve().body(JsonNode.class);
                if (response == null || !response.path("success").asBoolean(false)) {
                    throw new IllegalStateException("The accessibility source did not return a successful response");
                }
                List<AccessibleBuildingResponse> buildings = StreamSupport.stream(
                                response.path("result").path("records").spliterator(), false)
                        .map(AccessibleBuildingParser::parse)
                        .sorted(Comparator.comparing(AccessibleBuildingResponse::name, String.CASE_INSENSITIVE_ORDER))
                        .toList();
                snapshot = new Snapshot(Instant.now(), false, buildings);
                return snapshot;
            } catch (RuntimeException error) {
                if (cached != null) {
                    return new Snapshot(cached.fetchedAt(), true, cached.buildings());
                }
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Accessibility data is temporarily unavailable", error);
            }
        }
    }

    private boolean matches(AccessibleBuildingResponse building, String query) {
        return building.name().toLowerCase(Locale.ROOT).contains(query)
                || building.address().toLowerCase(Locale.ROOT).contains(query);
    }

    private record Snapshot(Instant fetchedAt, boolean stale, List<AccessibleBuildingResponse> buildings) {
    }
}
