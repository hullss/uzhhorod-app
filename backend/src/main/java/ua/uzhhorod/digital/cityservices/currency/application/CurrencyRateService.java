package ua.uzhhorod.digital.cityservices.currency.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import ua.uzhhorod.digital.cityservices.currency.api.CurrencyRateResponse;
import ua.uzhhorod.digital.cityservices.currency.api.CurrencyRatesResponse;

@Service
public class CurrencyRateService {

    private static final int UAH = 980;
    private static final Map<Integer, String> SUPPORTED_CURRENCIES = Map.of(
            840, "USD",
            978, "EUR",
            348, "HUF",
            985, "PLN");

    private final RestClient restClient;
    private final String sourceUrl;
    private final Duration cacheDuration;
    private volatile Snapshot snapshot;

    public CurrencyRateService(
            RestClient.Builder restClientBuilder,
            @Value("${city-services.currency.monobank-url}") String sourceUrl,
            @Value("${city-services.currency.cache-duration:PT5M}") Duration cacheDuration) {
        this.restClient = restClientBuilder.build();
        this.sourceUrl = sourceUrl;
        this.cacheDuration = cacheDuration;
    }

    public CurrencyRatesResponse getRates() {
        Snapshot current = currentSnapshot();
        return new CurrencyRatesResponse(current.fetchedAt(), current.stale(), current.rates());
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
            try {
                JsonNode response = restClient.get().uri(sourceUrl).retrieve().body(JsonNode.class);
                if (response == null || !response.isArray()) {
                    throw new IllegalStateException("Monobank did not return a currency rate array");
                }
                List<CurrencyRateResponse> rates = StreamSupport.stream(response.spliterator(), false)
                        .filter(rate -> rate.path("currencyCodeB").asInt() == UAH)
                        .filter(rate -> SUPPORTED_CURRENCIES.containsKey(rate.path("currencyCodeA").asInt()))
                        .map(this::toResponse)
                        .sorted(Comparator.comparingInt(rate -> currencyOrder(rate.code())))
                        .toList();
                if (rates.isEmpty()) {
                    throw new IllegalStateException("Monobank did not return supported UAH rates");
                }
                snapshot = new Snapshot(Instant.now(), false, rates);
                return snapshot;
            } catch (RuntimeException error) {
                if (cached != null) {
                    return new Snapshot(cached.fetchedAt(), true, cached.rates());
                }
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Currency rates are temporarily unavailable", error);
            }
        }
    }

    private CurrencyRateResponse toResponse(JsonNode rate) {
        BigDecimal crossRate = decimalValue(rate, "rateCross");
        BigDecimal buy = decimalValue(rate, "rateBuy");
        BigDecimal sell = decimalValue(rate, "rateSell");
        return new CurrencyRateResponse(
                SUPPORTED_CURRENCIES.get(rate.path("currencyCodeA").asInt()),
                buy != null ? buy : crossRate,
                sell != null ? sell : crossRate,
                Instant.ofEpochSecond(rate.path("date").asLong()));
    }

    private BigDecimal decimalValue(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isNumber() ? value.decimalValue() : null;
    }

    private int currencyOrder(String code) {
        return switch (code) {
            case "USD" -> 1;
            case "EUR" -> 2;
            case "HUF" -> 3;
            case "PLN" -> 4;
            default -> 99;
        };
    }

    private record Snapshot(Instant fetchedAt, boolean stale, List<CurrencyRateResponse> rates) {
    }
}
