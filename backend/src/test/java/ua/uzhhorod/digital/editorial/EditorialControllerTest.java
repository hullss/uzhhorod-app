package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EditorialControllerTest {
    @Test void fundsRejectEmptyIdentityAndUnsafeDonationUrls() throws Exception {
        var data = mapper.readTree("{\"items\":[{\"id\":\"\",\"title\":\"Fund\",\"description\":\"Description\",\"donationUrl\":\"https://send.monobank.ua/jar/example\",\"verifiedAt\":\"2026-01-01\",\"verificationSource\":\"Public source\"}]}");
        assertThrows(ResponseStatusException.class, () -> controller.saveDocument("defender-funds", "test-key", data));
        var item = (com.fasterxml.jackson.databind.node.ObjectNode) data.path("items").get(0);
        item.put("id", "fund-1"); item.put("donationUrl", "javascript:alert(1)");
        assertThrows(ResponseStatusException.class, () -> controller.saveDocument("defender-funds", "test-key", data));
        verify(repository, never()).save(any());
    }
    private final ObjectMapper mapper = new ObjectMapper();
    private final EditorialDocumentRepository repository = mock(EditorialDocumentRepository.class);
    private final EditorialController controller = new EditorialController(repository, mapper, mock(ua.uzhhorod.digital.cityservices.maps.application.SafetyMapPointService.class), "test-key");

    @Test void missingDocumentUsesValidatedSeedWithoutWritingDatabase() {
        when(repository.findById("events")).thenReturn(Optional.empty());
        var seed = controller.publicDocument("events");
        assertEquals(8, seed.path("items").size());
        assertDoesNotThrow(() -> EventDocumentValidator.validate(seed));
        verify(repository, never()).save(any());
    }
    @Test void intentionalEmptyDocumentStaysEmpty() {
        when(repository.findById("events")).thenReturn(Optional.of(new EditorialDocument("events", "{\"items\":[]}")));
        assertEquals(0, controller.publicDocument("events").path("items").size());
    }
    @Test void invalidEventsCannotBeSaved() throws Exception {
        var body = mapper.readTree(getClass().getResourceAsStream("/editorial/events.json"));
        var item = (com.fasterxml.jackson.databind.node.ObjectNode) body.path("items").get(0);
        item.put("date", "2026-02-30");
        assertThrows(ResponseStatusException.class, () -> controller.saveDocument("events", "test-key", body));
        verify(repository, never()).save(any());
        item.put("date", "2026-10-01"); item.put("sourceUrl", "javascript:alert(1)");
        assertThrows(ResponseStatusException.class, () -> EventDocumentValidator.validate(body));
        item.put("sourceUrl", "https://concert.ua/uk/event/example"); item.remove("date"); item.put("day", 1);
        assertThrows(ResponseStatusException.class, () -> EventDocumentValidator.validate(body));
    }
    @Test void duplicatesAndBadTimesAreRejected() throws Exception {
        var body = mapper.readTree(getClass().getResourceAsStream("/editorial/events.json"));
        var item = (com.fasterxml.jackson.databind.node.ObjectNode) body.path("items").get(1);
        item.put("id", body.path("items").get(0).path("id").asText());
        assertThrows(ResponseStatusException.class, () -> EventDocumentValidator.validate(body));
        item.put("id", "unique"); item.put("time", "25:00");
        assertThrows(ResponseStatusException.class, () -> EventDocumentValidator.validate(body));
    }
    @Test void savesRequireAdminKey() throws Exception {
        assertThrows(ResponseStatusException.class, () -> controller.saveDocument("events", "wrong", mapper.readTree("{\"items\":[]}")));
        verify(repository, never()).save(any());
    }
    @Test void supportsNonConcertCityEvents() throws Exception {
        var body = mapper.readTree(getClass().getResourceAsStream("/editorial/events.json"));
        var item = (com.fasterxml.jackson.databind.node.ObjectNode) body.path("items").get(0);
        for (var category : java.util.List.of("Виставки", "Лекції та зустрічі", "Майстер-класи", "Спорт", "Для дітей", "Фестивалі")) {
            item.put("category", category);
            assertDoesNotThrow(() -> EventDocumentValidator.validate(body));
        }
    }
}
