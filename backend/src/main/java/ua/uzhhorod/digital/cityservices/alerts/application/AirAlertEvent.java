package ua.uzhhorod.digital.cityservices.alerts.application;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "air_alert_events")
class AirAlertEvent {
    @Id
    private UUID id;

    @Column(nullable = false)
    private String state;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String detail;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    protected AirAlertEvent() {
    }

    AirAlertEvent(String state, String title, String detail, Instant occurredAt) {
        this.id = UUID.randomUUID();
        this.state = state;
        this.title = title;
        this.detail = detail;
        this.occurredAt = occurredAt;
    }

    String getState() { return state; }
    String getTitle() { return title; }
    String getDetail() { return detail; }
    Instant getOccurredAt() { return occurredAt; }
}
