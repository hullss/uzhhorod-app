package ua.uzhhorod.digital.notifications;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "push_subscriptions")
class PushSubscription {
    @Id
    @Column(name = "expo_push_token")
    private String expoPushToken;
    @Column(name = "alert_enabled", nullable = false)
    private boolean alertEnabled;
    @Column(name = "news_enabled", nullable = false)
    private boolean newsEnabled;
    @Column(name = "transport_enabled", nullable = false)
    private boolean transportEnabled;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected PushSubscription() { }
    PushSubscription(String expoPushToken, boolean alertEnabled, boolean newsEnabled, boolean transportEnabled) {
        this.expoPushToken = expoPushToken;
        update(alertEnabled, newsEnabled, transportEnabled);
    }
    String getExpoPushToken() { return expoPushToken; }
    boolean isAlertEnabled() { return alertEnabled; }
    void update(boolean alert, boolean news, boolean transport) {
        alertEnabled = alert; newsEnabled = news; transportEnabled = transport; updatedAt = Instant.now();
    }
}
