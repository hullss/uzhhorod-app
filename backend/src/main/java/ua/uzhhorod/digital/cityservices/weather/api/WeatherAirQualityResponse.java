package ua.uzhhorod.digital.cityservices.weather.api;

public record WeatherAirQualityResponse(
        int index,
        double pm25,
        double pm10) {
}
