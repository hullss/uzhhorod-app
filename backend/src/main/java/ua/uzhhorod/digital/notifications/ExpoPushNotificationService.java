package ua.uzhhorod.digital.notifications;

import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/** Sends only confirmed state transitions; disabled by default until Expo credentials are configured. */
@Service
public class ExpoPushNotificationService {
    private final PushSubscriptionRepository subscriptions;
    private final RestClient restClient;
    private final boolean enabled;

    public ExpoPushNotificationService(PushSubscriptionRepository subscriptions, RestClient.Builder restClientBuilder,
            @Value("${notifications.expo.enabled:false}") boolean enabled) {
        this.subscriptions = subscriptions;
        this.restClient = restClientBuilder.baseUrl("https://exp.host/--/api/v2").build();
        this.enabled = enabled;
    }

    public void sendAirAlert(String title, String detail, boolean active) {
        if (!enabled) return;
        List<Map<String, Object>> messages = subscriptions.findByAlertEnabledTrue().stream()
                .map(subscription -> Map.<String, Object>of(
                        "to", subscription.getExpoPushToken(), "title", title, "body", detail,
                        "sound", "default", "priority", "high", "data", Map.of("type", active ? "air-alert" : "air-alert-clear")))
                .toList();
        if (messages.isEmpty()) return;
        try {
            restClient.post().uri("/push/send").body(messages).retrieve().toBodilessEntity();
        } catch (RuntimeException ignored) {
            // A failed third-party delivery must not interrupt recording the official alert transition.
        }
    }
}
