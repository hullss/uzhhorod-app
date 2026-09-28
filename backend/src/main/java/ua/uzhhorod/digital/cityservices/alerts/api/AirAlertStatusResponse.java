package ua.uzhhorod.digital.cityservices.alerts.api;

import java.time.Instant;

public record AirAlertStatusResponse(
        State state,
        String title,
        String detail,
        Instant fetchedAt,
        boolean stale) {

    public enum State {
        CLEAR,
        ACTIVE,
        UNAVAILABLE
    }
}
