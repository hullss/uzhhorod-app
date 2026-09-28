package ua.uzhhorod.digital.cityservices.weather.api;

import java.time.Instant;

public record WeatherCurrentResponse(
        double temperatureC,
        double feelsLikeC,
        String condition,
        String iconUrl,
        double windKph,
        int humidity,
        WeatherAirQualityResponse airQuality,
        Instant observedAt) {
}
