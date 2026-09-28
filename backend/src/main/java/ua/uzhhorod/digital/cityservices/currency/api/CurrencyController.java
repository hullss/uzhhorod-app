package ua.uzhhorod.digital.cityservices.currency.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.currency.application.CurrencyRateService;

@RestController
@RequestMapping(path = "/api/city-services/currency", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class CurrencyController {

    private final CurrencyRateService currencyRateService;

    public CurrencyController(CurrencyRateService currencyRateService) {
        this.currencyRateService = currencyRateService;
    }

    @GetMapping
    public CurrencyRatesResponse getRates() {
        return currencyRateService.getRates();
    }
}
