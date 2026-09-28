package ua.uzhhorod.digital.cityservices.weather.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;
import ua.uzhhorod.digital.cityservices.weather.api.WeatherCurrentResponse;
import ua.uzhhorod.digital.cityservices.weather.api.WeatherAirQualityResponse;
import ua.uzhhorod.digital.cityservices.weather.api.WeatherDayResponse;
import ua.uzhhorod.digital.cityservices.weather.api.WeatherHourResponse;
import ua.uzhhorod.digital.cityservices.weather.api.WeatherResponse;

@Service
public class WeatherService {

    private final RestClient restClient;
    private final String apiUrl;
    private final String apiKey;
    private final Duration cacheDuration;
    private final double latitude;
    private final double longitude;
    private volatile Snapshot snapshot;

    public WeatherService(
            RestClient.Builder restClientBuilder,
            @Value("${city-services.weather.api-url}") String apiUrl,
            @Value("${city-services.weather.api-key}") String apiKey,
            @Value("${city-services.weather.cache-duration:PT15M}") Duration cacheDuration,
            @Value("${city-services.weather.latitude}") double latitude,
            @Value("${city-services.weather.longitude}") double longitude) {
        this.restClient = restClientBuilder.build();
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.cacheDuration = cacheDuration;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public WeatherResponse getWeather() {
        Snapshot current = currentSnapshot();
        return new WeatherResponse(current.fetchedAt(), current.stale(), current.current(), current.days());
    }

    private Snapshot currentSnapshot() {
        Snapshot cached = snapshot;
        if (cached != null && cached.fetchedAt().plus(cacheDuration).isAfter(Instant.now())) {
            return cached;
        }

        synchronized (this) {
            cached = snapshot;
            if (cached != null && cached.fetchedAt().plus(cacheDuration).isAfter(Instant.now())) {
                return cached;
            }
            if (apiKey.isBlank()) {
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Weather source is not configured");
            }
            try {
                String uri = UriComponentsBuilder.fromUriString(apiUrl)
                        .queryParam("key", apiKey)
                        .queryParam("q", latitude + "," + longitude)
                        .queryParam("days", 3)
                        .queryParam("aqi", "yes")
                        .queryParam("alerts", "no")
                        .queryParam("lang", "uk")
                        .build(true)
                        .toUriString();
                JsonNode response = restClient.get().uri(uri).retrieve().body(JsonNode.class);
                if (response == null || response.has("error")) {
                    throw new IllegalStateException("WeatherAPI did not return a forecast");
                }
                WeatherCurrentResponse current = parseCurrent(response.path("current"));
                List<WeatherDayResponse> days = StreamSupport.stream(
                                response.path("forecast").path("forecastday").spliterator(), false)
                        .map(this::parseDay)
                        .toList();
                if (days.isEmpty()) {
                    throw new IllegalStateException("WeatherAPI did not return forecast days");
                }
                snapshot = new Snapshot(Instant.now(), false, current, days);
                return snapshot;
            } catch (RuntimeException error) {
                if (cached != null) {
                    return new Snapshot(cached.fetchedAt(), true, cached.current(), cached.days());
                }
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Weather is temporarily unavailable", error);
            }
        }
    }

    private WeatherCurrentResponse parseCurrent(JsonNode current) {
        JsonNode airQuality = current.path("air_quality");
        int airQualityIndex = airQuality.path("us-epa-index").asInt();
        return new WeatherCurrentResponse(
                current.path("temp_c").asDouble(),
                current.path("feelslike_c").asDouble(),
                current.path("condition").path("text").asText(),
                secureIconUrl(current.path("condition").path("icon").asText()),
                current.path("wind_kph").asDouble(),
                current.path("humidity").asInt(),
                airQualityIndex > 0 ? new WeatherAirQualityResponse(
                        airQualityIndex,
                        airQuality.path("pm2_5").asDouble(),
                        airQuality.path("pm10").asDouble()) : null,
                Instant.ofEpochSecond(current.path("last_updated_epoch").asLong()));
    }

    private WeatherDayResponse parseDay(JsonNode forecastDay) {
        JsonNode day = forecastDay.path("day");
        JsonNode astro = forecastDay.path("astro");
        List<WeatherHourResponse> hours = StreamSupport.stream(forecastDay.path("hour").spliterator(), false)
                .map(this::parseHour)
                .toList();
        return new WeatherDayResponse(
                LocalDate.parse(forecastDay.path("date").asText()),
                day.path("mintemp_c").asDouble(),
                day.path("maxtemp_c").asDouble(),
                day.path("condition").path("text").asText(),
                secureIconUrl(day.path("condition").path("icon").asText()),
                day.path("daily_chance_of_rain").asInt(),
                astro.path("sunrise").asText(),
                astro.path("sunset").asText(),
                hours);
    }

    private WeatherHourResponse parseHour(JsonNode hour) {
        return new WeatherHourResponse(
                Instant.ofEpochSecond(hour.path("time_epoch").asLong()),
                hour.path("temp_c").asDouble(),
                hour.path("feelslike_c").asDouble(),
                hour.path("condition").path("text").asText(),
                secureIconUrl(hour.path("condition").path("icon").asText()),
                hour.path("chance_of_rain").asInt(),
                hour.path("wind_kph").asDouble());
    }

    private String secureIconUrl(String iconUrl) {
        return iconUrl.startsWith("//") ? "https:" + iconUrl : iconUrl;
    }

    private record Snapshot(
            Instant fetchedAt,
            boolean stale,
            WeatherCurrentResponse current,
            List<WeatherDayResponse> days) {
    }
}
