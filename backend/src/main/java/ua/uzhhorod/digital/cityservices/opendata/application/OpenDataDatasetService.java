package ua.uzhhorod.digital.cityservices.opendata.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import ua.uzhhorod.digital.cityservices.opendata.api.OpenDataDatasetListResponse;
import ua.uzhhorod.digital.cityservices.opendata.api.OpenDataDatasetResponse;

@Service
public class OpenDataDatasetService {

    private final RestClient restClient;
    private final String sourceUrl;
    private final String catalogUrl;
    private final Duration cacheDuration;
    private volatile Snapshot snapshot;

    public OpenDataDatasetService(
            RestClient.Builder restClientBuilder,
            @Value("${city-services.open-data.catalog-api-url}") String sourceUrl,
            @Value("${city-services.open-data.catalog-url}") String catalogUrl,
            @Value("${city-services.open-data.cache-duration:PT15M}") Duration cacheDuration) {
        this.restClient = restClientBuilder.build();
        this.sourceUrl = sourceUrl;
        this.catalogUrl = catalogUrl;
        this.cacheDuration = cacheDuration;
    }

    public OpenDataDatasetListResponse getLatestDatasets() {
        Snapshot current = currentSnapshot();
        return new OpenDataDatasetListResponse(current.fetchedAt(), current.stale(), current.datasets());
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
                    throw new IllegalStateException("The open data source did not return a successful response");
                }
                List<OpenDataDatasetResponse> datasets = StreamSupport.stream(
                                response.path("result").path("results").spliterator(), false)
                        .map(dataset -> OpenDataDatasetParser.parse(dataset, catalogUrl))
                        .toList();
                snapshot = new Snapshot(Instant.now(), false, datasets);
                return snapshot;
            } catch (RuntimeException error) {
                if (cached != null) {
                    return new Snapshot(cached.fetchedAt(), true, cached.datasets());
                }
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Open data is temporarily unavailable", error);
            }
        }
    }

    private record Snapshot(Instant fetchedAt, boolean stale, List<OpenDataDatasetResponse> datasets) {
    }
}
