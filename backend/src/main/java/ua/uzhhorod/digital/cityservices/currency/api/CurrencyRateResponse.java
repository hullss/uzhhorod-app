package ua.uzhhorod.digital.cityservices.currency.api;

import java.math.BigDecimal;
import java.time.Instant;

public record CurrencyRateResponse(
        String code,
        BigDecimal buy,
        BigDecimal sell,
        Instant updatedAt) {
}
