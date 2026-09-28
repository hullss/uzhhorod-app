package ua.uzhhorod.digital.cityservices.weather.api;

import java.time.LocalDate;
import java.util.List;

public record WeatherDayResponse(
        LocalDate date,
        double minTemperatureC,
        double maxTemperatureC,
        String condition,
        String iconUrl,
        int chanceOfRain,
        String sunrise,
        String sunset,
        List<WeatherHourResponse> hours) {
}
