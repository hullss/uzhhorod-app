package ua.uzhhorod.digital.cityservices.alerts.api;

import java.time.Instant;

public record AirAlertEventResponse(
        AirAlertStatusResponse.State state,
        String title,
        String detail,
        Instant occurredAt) {
}
