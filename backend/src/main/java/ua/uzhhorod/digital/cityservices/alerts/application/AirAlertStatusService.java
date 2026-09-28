package ua.uzhhorod.digital.cityservices.alerts.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import ua.uzhhorod.digital.cityservices.alerts.api.AirAlertStatusResponse;
import ua.uzhhorod.digital.cityservices.alerts.api.AirAlertStatusResponse.State;

/**
 * Uses the backend as a proxy so the alerts.in.ua token never reaches the mobile app.
 */
@Service
public class AirAlertStatusService {

    private static final String ZAKARPATTIA = "Закарпатська область";

    private final RestClient restClient;
    private final String apiUrl;
    private final String apiToken;
    private final Duration cacheDuration;
    private volatile Snapshot snapshot;

    public AirAlertStatusService(
            RestClient.Builder restClientBuilder,
            @Value("${city-services.alerts.api-url}") String apiUrl,
            @Value("${city-services.alerts.api-token:}") String apiToken,
            @Value("${city-services.alerts.cache-duration:PT30S}") Duration cacheDuration) {
        this.restClient = restClientBuilder.build();
        this.apiUrl = apiUrl;
        this.apiToken = apiToken;
        this.cacheDuration = cacheDuration;
    }

    public AirAlertStatusResponse getStatus() {
        Snapshot current = currentSnapshot();
        return new AirAlertStatusResponse(current.state(), current.title(), current.detail(), current.fetchedAt(), current.stale());
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
            if (apiToken.isBlank()) {
                return unavailable();
            }
            try {
                JsonNode response = restClient.get()
                        .uri(apiUrl)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiToken)
                        .retrieve()
                        .body(JsonNode.class);
                if (response == null || !response.path("alerts").isArray()) {
                    throw new IllegalStateException("alerts.in.ua returned an unexpected response");
                }
                JsonNode regionalAlert = StreamSupport.stream(response.path("alerts").spliterator(), false)
                        .filter(this::isZakarpattiaAlert)
                        .findFirst()
                        .orElse(null);
                snapshot = regionalAlert == null
                        ? new Snapshot(State.CLEAR, "Повітряної тривоги немає", "У Закарпатській області", Instant.now(), false)
                        : activeSnapshot(regionalAlert);
                return snapshot;
            } catch (RuntimeException error) {
                if (cached != null) {
                    return new Snapshot(cached.state(), cached.title(), cached.detail(), cached.fetchedAt(), true);
                }
                return unavailable();
            }
        }
    }

    private boolean isZakarpattiaAlert(JsonNode alert) {
        return ZAKARPATTIA.equalsIgnoreCase(alert.path("location_oblast").asText())
                || ZAKARPATTIA.equalsIgnoreCase(alert.path("location_title").asText());
    }

    private Snapshot activeSnapshot(JsonNode alert) {
        String location = alert.path("location_title").asText(ZAKARPATTIA);
        String alertType = alert.path("alert_type").asText();
        String detail = "air_raid".equals(alertType) ? "Слідкуйте за офіційними повідомленнями" : "Зафіксовано загрозу — перевірте офіційні канали";
        return new Snapshot(State.ACTIVE, "Тривога: " + location, detail, Instant.now(), false);
    }

    private Snapshot unavailable() {
        return new Snapshot(State.UNAVAILABLE, "Статус тривоги недоступний", "Перевіряйте офіційний застосунок «Повітряна тривога»", Instant.now(), false);
    }

    private record Snapshot(State state, String title, String detail, Instant fetchedAt, boolean stale) {
    }
}
