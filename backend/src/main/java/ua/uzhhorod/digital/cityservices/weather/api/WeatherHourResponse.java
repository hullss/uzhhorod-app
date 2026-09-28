package ua.uzhhorod.digital.cityservices.weather.api;

import java.time.Instant;

public record WeatherHourResponse(
        Instant time,
        double temperatureC,
        double feelsLikeC,
        String condition,
        String iconUrl,
        int chanceOfRain,
        double windKph) {
}
