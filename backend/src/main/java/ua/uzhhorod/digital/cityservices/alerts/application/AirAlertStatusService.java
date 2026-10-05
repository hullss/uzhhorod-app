package ua.uzhhorod.digital.cityservices.alerts.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.scheduling.annotation.Scheduled;
import ua.uzhhorod.digital.cityservices.alerts.api.AirAlertEventResponse;
import ua.uzhhorod.digital.cityservices.alerts.api.AirAlertEventsResponse;
import org.springframework.web.client.RestClient;
import ua.uzhhorod.digital.cityservices.alerts.api.AirAlertStatusResponse;
import ua.uzhhorod.digital.cityservices.alerts.api.AirAlertStatusResponse.State;
import ua.uzhhorod.digital.notifications.ExpoPushNotificationService;

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
    private final AirAlertEventRepository events;
    private final ExpoPushNotificationService notifications;
    private volatile Snapshot snapshot;
    private volatile State lastRecordedState;

    public AirAlertStatusService(
            RestClient.Builder restClientBuilder,
            @Value("${city-services.alerts.api-url}") String apiUrl,
            @Value("${city-services.alerts.api-token:}") String apiToken,
            @Value("${city-services.alerts.cache-duration:PT30S}") Duration cacheDuration,
            AirAlertEventRepository events,
            ExpoPushNotificationService notifications) {
        this.restClient = restClientBuilder.build();
        this.apiUrl = apiUrl;
        this.apiToken = apiToken;
        this.cacheDuration = cacheDuration;
        this.events = events;
        this.notifications = notifications;
        this.lastRecordedState = events.findTopByOrderByOccurredAtDesc()
                .map(event -> State.valueOf(event.getState()))
                .orElse(null);
    }

    public AirAlertStatusResponse getStatus() {
        Snapshot current = currentSnapshot();
        return new AirAlertStatusResponse(current.state(), current.title(), current.detail(), current.fetchedAt(), current.stale());
    }

    public AirAlertEventsResponse getEvents() {
        List<AirAlertEventResponse> history = events.findTop50ByOrderByOccurredAtDesc().stream()
                .map(event -> new AirAlertEventResponse(
                        State.valueOf(event.getState()),
                        event.getTitle(),
                        event.getDetail(),
                        event.getOccurredAt()))
                .toList();
        return new AirAlertEventsResponse(history);
    }

    @Scheduled(fixedDelayString = "${city-services.alerts.poll-delay:30000}")
    public void pollForChanges() {
        currentSnapshot();
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
                recordTransition(snapshot);
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

    private void recordTransition(Snapshot current) {
        if (current.state() == State.UNAVAILABLE || current.stale()) {
            return;
        }
        State previous = lastRecordedState;
        if (previous == null) {
            lastRecordedState = current.state();
            return;
        }
        if (previous == current.state()) {
            return;
        }
        String title = current.state() == State.ACTIVE ? current.title() : "Відбій повітряної тривоги";
        String detail = current.state() == State.ACTIVE ? current.detail() : "У Закарпатській області";
        events.save(new AirAlertEvent(current.state().name(), title, detail, current.fetchedAt()));
        notifications.sendAirAlert(title, detail, current.state() == State.ACTIVE);
        lastRecordedState = current.state();
    }

    private record Snapshot(State state, String title, String detail, Instant fetchedAt, boolean stale) {
    }
}
