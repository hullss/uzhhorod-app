package ua.uzhhorod.digital.cityservices.weather.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.weather.application.WeatherService;

@RestController
@RequestMapping(path = "/api/city-services/weather", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class WeatherController {

    private final WeatherService weatherService;

    public WeatherController(WeatherService weatherService) {
        this.weatherService = weatherService;
    }

    @GetMapping
    public WeatherResponse getWeather() {
        return weatherService.getWeather();
    }
}
