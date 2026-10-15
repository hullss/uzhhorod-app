package ua.uzhhorod.digital.cityservices.power;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.web.client.RestClient;
import static org.junit.jupiter.api.Assertions.*;

/** Opt-in, read-only public provider check; never loads Spring or a database. */
@EnabledIfSystemProperty(named = "power.live", matches = "true")
class PowerOutageLiveTest {
    @Test void publicProviderContract() {
        var service = new PowerOutageService(RestClient.builder(), "https://api-outage-zakarpat-energy.inneti.net/api");
        int city = service.cities().stream().filter(p -> p.name().equals("Ужгород")).findFirst().orElseThrow().id();
        int street = service.streets(city).stream().filter(p -> p.name().equals("Оноківська")).findFirst().orElseThrow().id();
        var status = service.status(city, street, "1");
        assertNotNull(status.checkedAt()); assertNotNull(status.sourceUpdatedAt()); assertTrue(status.addressKnown());
        assertEquals(PowerOutageService.SOURCE, status.sourceUrl());
        System.out.println("Public outage adapter: canonical Uzhhorod street and house matched; source timestamp received.");
    }
}
