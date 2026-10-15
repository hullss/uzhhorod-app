package ua.uzhhorod.digital.editorial;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.sun.net.httpserver.HttpServer;
import java.lang.reflect.Proxy;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import ua.uzhhorod.digital.cityservices.maps.application.SafetyMapPointService;

/** Real service/controller/store, fake repository + isolated loopback feed; no database writes. */
public final class SafetyMapCheck {
    public static void main(String[] args) throws Exception {
        var mapper = new ObjectMapper(); var rows = new HashMap<String, EditorialDocument>();
        var repo = (EditorialDocumentRepository) Proxy.newProxyInstance(SafetyMapCheck.class.getClassLoader(), new Class<?>[]{EditorialDocumentRepository.class}, (proxy, method, values) -> {
            if (method.getName().equals("findById")) return Optional.ofNullable(rows.get(values[0]));
            if (method.getName().equals("save")) { var doc = (EditorialDocument) values[0]; rows.put(doc.key(), doc); return doc; }
            throw new UnsupportedOperationException(method.getName());
        });
        var hits = new AtomicInteger();
        var feed = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        feed.createContext("/feed", exchange -> {
            hits.incrementAndGet();
            var bytes = "{\"features\":[{\"properties\":{\"id\":\"qa-1\",\"name\":\"QA shelter\",\"address\":\"QA address\"},\"geometry\":{\"type\":\"Point\",\"coordinates\":[22.28,48.62]}}]}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json"); exchange.sendResponseHeaders(200, bytes.length);
            try (var output = exchange.getResponseBody()) { output.write(bytes); }
        });
        feed.start();
        try {
            var store = new EditorialSafetyMapStore(repo, mapper);
            var maps = new SafetyMapPointService(RestClient.builder(), mapper, store, "http://127.0.0.1:" + feed.getAddress().getPort() + "/feed", Duration.ofMinutes(30));
            var editor = new EditorialController(repo, mapper, maps, "test-only");
            var imported = editor.adminDocument("shelters", "test-only");
            require(imported.path("items").size() == 1 && rows.isEmpty(), "Import must not write database");
            var point = (ObjectNode) imported.path("items").get(0);
            point.put("address", "QA corrected address"); point.put("description", "QA entrance"); point.put("latitude", 48.63);
            point.put("sourceUrl", "https://example.org/qa"); point.put("verifiedAt", "2026-01-01");
            editor.saveDocument("shelters", "test-only", imported);
            var result = maps.getShelters();
            require(result.source().equals("editorial") && result.stale() && result.points().size() == 1, "Published list wins");
            require(result.points().get(0).latitude() == 48.63 && result.points().get(0).address().equals("QA corrected address") && result.points().get(0).description().equals("QA entrance"), "Published fields reach map API");
            require(hits.get() == 1, "Published data must bypass the feed/cache");
            var reopened = editor.adminDocument("shelters", "test-only"); require(reopened.path("items").get(0).path("id").asText().equals("shelter-qa-1"), "Stable identity");
            editor.saveDocument("resilience", "test-only", imported);
            require(maps.getResiliencePoints().points().get(0).description().equals("QA entrance"), "Resilience uses store too");
            editor.saveDocument("shelters", "test-only", mapper.readTree("{\"items\":[]}"));
            require(maps.getShelters().points().isEmpty() && hits.get() == 1, "Deleted points cannot reappear from feed");
            require(maps.getResiliencePoints().points().size() == 1, "Lists must be independent");
            for (var invalid : new String[]{"{\"latitude\":22.28}", "{\"longitude\":48.62}", "{\"latitude\":null}", "{\"address\":\"\"}", "{\"sourceUrl\":\"javascript:alert(1)\"}", "{\"verifiedAt\":\"2099-01-01\"}", "{\"verifiedAt\":\"2026-02-30\"}"}) {
                var copy = imported.deepCopy(); ((ObjectNode)copy.path("items").get(0)).setAll((ObjectNode) mapper.readTree(invalid));
                rejected(() -> editor.saveDocument("resilience", "test-only", copy));
            }
            var duplicate = imported.deepCopy(); ((com.fasterxml.jackson.databind.node.ArrayNode)duplicate.path("items")).add(point.deepCopy());
            rejected(() -> editor.saveDocument("resilience", "test-only", duplicate));
            rejected(() -> editor.saveDocument("resilience", "wrong", imported));
            require(maps.getResiliencePoints().points().size() == 1, "Invalid writes must preserve published data");
            rows.remove("shelters");
            var unavailableMaps = new SafetyMapPointService(RestClient.builder(), mapper, store, "http://127.0.0.1:" + feed.getAddress().getPort() + "/unavailable", Duration.ZERO);
            try {
                new EditorialController(repo, mapper, unavailableMaps, "test-only").adminDocument("shelters", "test-only");
                throw new AssertionError("Failed import must not become an empty list");
            } catch (ResponseStatusException expected) { require(expected.getStatusCode().value() == 502, "Source failure is not an admin-key configuration failure"); }
            System.out.println("PASS: real controller/store/map API: import, publish, edits, metadata, stable IDs, independent lists, empty deletion, feed bypass, validation and authorization");
        } finally { feed.stop(0); }
    }
    private static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
    private static void rejected(Runnable check) { try { check.run(); } catch (ResponseStatusException expected) { return; } throw new AssertionError("Invalid request accepted"); }
}
