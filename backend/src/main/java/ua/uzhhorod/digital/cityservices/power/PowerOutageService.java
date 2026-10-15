package ua.uzhhorod.digital.cityservices.power;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.StreamSupport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

/** Read-only adapter for the public widget embedded on zakarpat.energy. No partner SLA. */
@Service
public class PowerOutageService {
    public static final String SOURCE = "https://zakarpat.energy/customers/break-in-electricity-supply/realtime-outage/";
    private final RestClient client;
    private final String base;
    private final Map<String, Cached> cache = new LinkedHashMap<>();
    public PowerOutageService(RestClient.Builder builder,
            @Value("${city-services.power.api-url:https://api-outage-zakarpat-energy.inneti.net/api}") String base) {
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(5));
        this.client = builder.clone().requestFactory(factory).build();
        this.base = base.replaceAll("/$", "");
    }
    public record Place(int id, String name) {}
    public record Event(String id, String kind, String reason, Instant startsAt, Instant expectedRestoration, boolean planned) {}
    public record Status(Instant checkedAt, Instant sourceUpdatedAt, boolean stale, boolean addressKnown,
                         boolean uncertain, List<String> queues, List<Event> outages, String sourceUrl) {}
    private record Cached(Instant fetchedAt, List<JsonNode> items) {}

    public List<Place> cities() { return places(read("pw_cities?pagination=false", Duration.ofHours(12))); }
    public List<Place> streets(int cityId) {
        requireCity(cityId);
        return places(read("pw_streets?pagination=false&city.id=" + cityId, Duration.ofHours(12)));
    }
    private List<Place> places(List<JsonNode> nodes) {
        return nodes.stream().map(n -> new Place(n.path("id").asInt(), n.path("name").asText().trim()))
                .filter(p -> p.id() > 0 && !p.name().isBlank()).sorted(Comparator.comparing(Place::name)).toList();
    }
    private void requireCity(int cityId) {
        if (cityId <= 0 || cities().stream().noneMatch(p -> p.id() == cityId)) badAddress();
    }
    private static void badAddress() { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown address"); }

    public Status status(int cityId, int streetId, String building) {
        String house = normalizeHouse(building);
        if (!house.matches("\\d{1,5}[\\p{L}]?(?:[/-]\\d{1,5}[\\p{L}]?)?")) badAddress();
        if (streets(cityId).stream().noneMatch(s -> s.id() == streetId)) badAddress();
        String filter = "&city.id=" + cityId + "&street.id=" + streetId;
        List<JsonNode> active = read("pw_accidents?page=1" + filter, Duration.ofMinutes(3));
        List<JsonNode> planned = read("pw_accident_planeds?page=1" + filter, Duration.ofMinutes(3));
        List<JsonNode> addresses = read("pw_address_queues?page=1" + filter, Duration.ofHours(6));
        if (addresses.stream().anyMatch(n -> n.path("city").path("id").asInt() != cityId || n.path("street").path("id").asInt() != streetId)) throw unavailable();
        List<JsonNode> sync = read("options?option_key=successful_last_synk", Duration.ofMinutes(3));
        Instant updated = sync.stream().filter(n -> n.path("optionKey").asText(n.path("option_key").asText()).equals("successful_last_synk"))
                .map(n -> date(n.path("date"))).filter(Objects::nonNull).findFirst().orElse(null);
        Instant now = Instant.now();
        List<Event> events = new ArrayList<>();
        boolean known = addresses.stream().anyMatch(n -> includes(n.path("buildingNames").asText(), house));
        boolean uncertain = false;
        for (boolean isPlanned : List.of(false, true)) {
            for (JsonNode n : isPlanned ? planned : active) {
                // A changed upstream filter must never leak another street into an address result.
                if (n.path("city").path("id").asInt() != cityId || n.path("street").path("id").asInt() != streetId)
                    throw unavailable();
                Instant start = date(n.path("dateEvent"));
                Instant end = date(n.path("datePlanIn"));
                if (isPlanned && end != null && end.isBefore(now)) continue;
                if (isPlanned && (start == null || end == null)) throw unavailable();
                String houses = n.path("buildingNames").asText();
                if (!includes(houses, house)) {
                    // Ranges, blank lists and nonstandard descriptions are not exact house matches.
                    if (houses.isBlank() || Arrays.stream(houses.split(",")).map(PowerOutageService::normalizeHouse)
                            .anyMatch(v -> !v.isBlank() && !v.matches("\\d{1,5}[\\p{L}]?(?:[/-]\\d{1,5}[\\p{L}]?)?"))) uncertain = true;
                    continue;
                }
                known = true;
                if (!isPlanned && end != null && end.isBefore(now)) uncertain = true;
                int sub = n.path("switchSubReason").asInt();
                String kind = isPlanned ? "planned" : sub > 0 ? "scheduled" : n.path("typeOff").asInt() == 0 ? "planned" : "emergency";
                events.add(new Event(n.path("@id").asText(), kind, n.path("koment").asText(), start, end, isPlanned));
            }
        }
        List<String> queues = addresses.stream().filter(n -> includes(n.path("buildingNames").asText(), house))
                .map(n -> n.path("chergGpv").asText()).filter(q -> q.matches("\\d+(?:\\.\\d+)?")).distinct().toList();
        events.sort(Comparator.comparing(Event::startsAt, Comparator.nullsLast(Comparator.naturalOrder())));
        Instant checked = fetchedAt("pw_accidents?page=1" + filter);
        Instant plannedChecked = fetchedAt("pw_accident_planeds?page=1" + filter);
        if (plannedChecked.isBefore(checked)) checked = plannedChecked;
        return new Status(checked, updated, updated == null || updated.isBefore(now.minus(Duration.ofHours(24)))
                || updated.isAfter(now.plus(Duration.ofMinutes(10))), known, uncertain, queues, List.copyOf(events), SOURCE);
    }
    public static String normalizeHouse(String value) {
        return value == null ? "" : value.strip().toUpperCase(Locale.ROOT).replaceAll("\\s+", "")
                .replace('А', 'A').replace('В', 'B').replace('Е', 'E').replace('І', 'I').replace('К', 'K')
                .replace('М', 'M').replace('Н', 'H').replace('О', 'O').replace('Р', 'P').replace('С', 'C').replace('Т', 'T').replace('Х', 'X');
    }
    public static boolean includes(String list, String house) {
        return Arrays.stream(list.split(",")).map(PowerOutageService::normalizeHouse).anyMatch(house::equals);
    }
    private static Instant date(JsonNode n) {
        try { return Instant.parse(n.asText()); } catch (RuntimeException ignored) { return null; }
    }
    private static ResponseStatusException unavailable() {
        return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Power outage source unavailable");
    }
    private synchronized Instant fetchedAt(String path) {
        Cached item = cache.get(path);
        return item == null ? Instant.now() : item.fetchedAt();
    }
    // Bounded, short-lived street cache. No home address or house number is persisted on the server.
    private synchronized List<JsonNode> read(String path, Duration ttl) {
        Cached saved = cache.get(path);
        if (saved != null && saved.fetchedAt().plus(ttl).isAfter(Instant.now())) return saved.items();
        try {
            List<JsonNode> result = new ArrayList<>();
            String pagePath = path;
            for (int page = 1; page <= 20; page++) {
                JsonNode doc = client.get().uri(base + "/" + pagePath).retrieve().body(JsonNode.class);
                if (doc == null || !doc.path("hydra:member").isArray()) throw unavailable();
                result.addAll(StreamSupport.stream(doc.path("hydra:member").spliterator(), false).toList());
                if (!doc.path("hydra:view").has("hydra:next")) break;
                if (page == 20 || !path.contains("page=1")) throw unavailable();
                // Do not follow URLs supplied by upstream (SSRF); only advance the original fixed query.
                pagePath = path.replace("page=1", "page=" + (page + 1));
            }
            if (cache.size() >= 256) cache.remove(cache.keySet().iterator().next());
            cache.put(path, new Cached(Instant.now(), List.copyOf(result)));
            return List.copyOf(result);
        } catch (RuntimeException ex) { throw unavailable(); }
    }
}
