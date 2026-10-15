package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Path;
import java.util.List;
import org.springframework.web.server.ResponseStatusException;

/** Isolated checks using cached dependencies; no Spring server or database writes. */
public final class EditorialValidatorCheck {
    public static void main(String[] args) throws Exception {
        var mapper = new ObjectMapper();
        var body = mapper.readTree(Path.of(args[0]).toFile());
        EventDocumentValidator.validate(body);
        var item = (ObjectNode) body.path("items").get(0);
        for (var category : List.of("Концерти", "Театр", "Виставки", "Лекції та зустрічі", "Майстер-класи", "Спорт", "Для дітей", "Фестивалі", "Інше")) {
            item.put("category", category); EventDocumentValidator.validate(body);
        }
        System.out.println("PASS: seed and all nine city-event categories");
        item.put("date", "2026-02-30"); rejected(() -> EventDocumentValidator.validate(body));
        item.put("date", "2026-10-01"); item.put("time", "25:00"); rejected(() -> EventDocumentValidator.validate(body));
        item.put("time", "18:30"); item.put("sourceUrl", "javascript:alert(1)"); rejected(() -> EventDocumentValidator.validate(body));
        item.put("sourceUrl", "https://192.168.1.1/event"); rejected(() -> EventDocumentValidator.validate(body));
        item.put("sourceUrl", "https://example.org/event");
        ((ObjectNode) body.path("items").get(1)).put("id", item.path("id").asText());
        rejected(() -> EventDocumentValidator.validate(body));
        EventDocumentValidator.validate(mapper.readTree("{\"items\":[]}"));
        if (!"forward:/admin/index.html".equals(new EditorialPageController().editor())) throw new AssertionError("Wrong editor route");
        System.out.println("PASS: invalid dates/times/URLs/duplicates rejected; empty list and editor forwarding");
    }
    private static void rejected(Runnable check) {
        try { check.run(); } catch (ResponseStatusException expected) { return; }
        throw new AssertionError("Invalid document was accepted");
    }
}
