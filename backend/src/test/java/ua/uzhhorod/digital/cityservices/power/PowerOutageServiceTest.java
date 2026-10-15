package ua.uzhhorod.digital.cityservices.power;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

class PowerOutageServiceTest {
    private String active = "[]", planned = "[]", sync = Instant.now().toString();
    private String addresses = "[{\"city\":{\"id\":769},\"street\":{\"id\":9479},\"buildingNames\":\"1, 10, 19А\",\"chergGpv\":\"4.1\"}]";
    private boolean broken, paginated;
    private final AtomicInteger calls = new AtomicInteger();
    private String event(String id, String houses, boolean future) {
        return "{\"@id\":\"" + id + "\",\"city\":{\"id\":769},\"street\":{\"id\":9479},\"buildingNames\":\"" + houses
                + "\",\"typeOff\":1,\"dateEvent\":\"" + Instant.now().plusSeconds(future ? 3600 : -3600)
                + "\",\"datePlanIn\":\"" + Instant.now().plusSeconds(future ? 7200 : -1) + "\",\"koment\":\"Ремонт\"}";
    }
    private HttpServer server() throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/api/", exchange -> {
            calls.incrementAndGet();
            String path = exchange.getRequestURI().getPath(), query = exchange.getRequestURI().getQuery();
            String members = switch (path) {
                case "/api/pw_cities" -> "[{\"id\":769,\"name\":\"Ужгород\"}]";
                case "/api/pw_streets" -> "[{\"id\":9479,\"name\":\"Оноківська\"}]";
                case "/api/pw_address_queues" -> addresses;
                case "/api/options" -> "[{\"optionKey\":\"successful_last_synk\",\"date\":\"" + sync + "\"}]";
                case "/api/pw_accidents" -> paginated && query.startsWith("page=2") ? "[" + event("second", "1", true) + "]" : active;
                case "/api/pw_accident_planeds" -> planned;
                default -> "[]";
            };
            String view = paginated && path.equals("/api/pw_accidents") && query.startsWith("page=1")
                    ? ",\"hydra:view\":{\"hydra:next\":\"http://untrusted.invalid/private\"}" : "";
            byte[] body = (broken ? "{}" : "{\"hydra:member\":" + members + view + "}").getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length); exchange.getResponseBody().write(body); exchange.close();
        });
        server.start(); return server;
    }
    private PowerOutageService service(HttpServer server) {
        return new PowerOutageService(RestClient.builder(), "http://127.0.0.1:" + server.getAddress().getPort() + "/api");
    }
    @Test void exactBuildingAndKnownAddressRequired() throws Exception {
        active = "[" + event("outage-10", "10, 19А", false) + "]";
        HttpServer server = server();
        try {
            var service = service(server);
            var one = service.status(769, 9479, "1");
            assertTrue(one.addressKnown()); assertTrue(one.outages().isEmpty()); assertFalse(one.uncertain());
            var ten = service.status(769, 9479, "10");
            assertEquals(1, ten.outages().size()); assertTrue(ten.uncertain()); // elapsed estimate, not silently 'restored'
            assertTrue(service.status(769, 9479, "19A").addressKnown());
            assertFalse(service.status(769, 9479, "999").addressKnown());
            int before = calls.get(); service.status(769, 9479, "1"); assertEquals(before, calls.get());
            assertThrows(ResponseStatusException.class, () -> service.status(769, 9479, "1<script>"));
            assertThrows(ResponseStatusException.class, () -> service.status(769, 999, "1"));
        } finally { server.stop(0); }
    }
    @Test void plannedFutureAndSourceFreshness() throws Exception {
        planned = "[" + event("expired", "1", false) + "," + event("future", "1", true) + "]";
        sync = Instant.now().minusSeconds(90000).toString();
        HttpServer server = server();
        try {
            var response = service(server).status(769, 9479, "1");
            assertTrue(response.stale()); assertEquals(1, response.outages().size());
            assertEquals("future", response.outages().getFirst().id()); assertEquals("planned", response.outages().getFirst().kind());
        } finally { server.stop(0); }
    }
    @Test void incompleteMalformedAndPaginatedDataNeverMeansClear() throws Exception {
        active = "[" + event("ambiguous", "всі будинки", true) + "]";
        HttpServer server = server();
        try {
            assertTrue(service(server).status(769, 9479, "1").uncertain());
            active = "[]"; paginated = true;
            assertEquals(1, service(server).status(769, 9479, "1").outages().size());
            broken = true;
            assertThrows(ResponseStatusException.class, () -> service(server).cities());
        } finally { server.stop(0); }
    }
}
