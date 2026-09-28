package ua.uzhhorod.digital.cityservices.weather.api;

import java.time.Instant;
import java.util.List;

public record WeatherResponse(
        Instant fetchedAt,
        boolean stale,
        WeatherCurrentResponse current,
        List<WeatherDayResponse> days) {
}
