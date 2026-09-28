package ua.uzhhorod.digital.cityservices.currency.api;

import java.time.Instant;
import java.util.List;

public record CurrencyRatesResponse(
        Instant fetchedAt,
        boolean stale,
        List<CurrencyRateResponse> rates) {
}
