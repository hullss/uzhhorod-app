package ua.uzhhorod.digital.transport.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import ua.uzhhorod.digital.transport.api.TransportVehiclePositionResponse;
import ua.uzhhorod.digital.transport.api.TransportVehiclePositionsResponse;

/**
 * Proxies the live data endpoint used by the public DozoR Uzhhorod map.
 *
 * The old devices.json link on the municipal portal returns HTTP 404. DozoR's active API has two
 * calls: t=1 provides route IDs and short names, t=2&p=<route IDs> provides GPS devices.
 */
@Service
public class TransportVehiclePositionService {

    private static final Logger log = LoggerFactory.getLogger(TransportVehiclePositionService.class);
    private static final String DOZOR_USER_AGENT = "Mozilla/5.0 (compatible; UzhhorodPoruch/1.0)";

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String sourceUrl;
    private final String sourceReferer;
    private final Duration cacheDuration;
    private volatile Snapshot snapshot;
    private volatile boolean sourceSessionInitialized;
    private volatile String sourceSessionCookie;

    public TransportVehiclePositionService(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${transport.realtime-source-url}") String sourceUrl,
            @Value("${transport.realtime-source-referer}") String sourceReferer,
            @Value("${transport.realtime-cache-duration:PT20S}") Duration cacheDuration) {
        this.restClient = restClientBuilder.build();
        this.objectMapper = objectMapper;
        this.sourceUrl = sourceUrl;
        this.sourceReferer = sourceReferer;
        this.cacheDuration = cacheDuration;
    }

    public TransportVehiclePositionsResponse getPositions(String routeNumber) {
        if (routeNumber == null || routeNumber.isBlank()) {
            return new TransportVehiclePositionsResponse(false, false, Instant.now(), List.of());
        }
        Snapshot current = currentSnapshot(routeNumber.trim());
        return new TransportVehiclePositionsResponse(
                current.available(), current.stale(), current.fetchedAt(), current.vehicles());
    }

    private Snapshot currentSnapshot(String requestedRoute) {
        Snapshot cached = snapshot;
        if (isFresh(cached, requestedRoute)) {
            return cached;
        }
        synchronized (this) {
            cached = snapshot;
            if (isFresh(cached, requestedRoute)) {
                return cached;
            }
            try {
                Map<Long, String> routes = parseRoutes(fetchSource("?t=1"));
                Long dozorRouteId = findRouteId(routes, requestedRoute);
                if (dozorRouteId == null) {
                    // The route exists in the planned GTFS schedule but is not in the live DozoR map.
                    log.warn("DozoR Uzhhorod did not return route {} among {} routes", requestedRoute, routes.size());
                    return new Snapshot(requestedRoute, true, false, Instant.now(), List.of());
                }
                Instant fetchedAt = Instant.now();
                JsonNode vehicleSource = fetchSource("?t=2&p=" + dozorRouteId);
                List<TransportVehiclePositionResponse> vehicles = parseVehicles(
                        // DozoR reliably returns positions when one selected route id is requested.
                        // Requesting all route ids at once can yield an empty data set.
                        vehicleSource,
                        Map.of(dozorRouteId, routes.get(dozorRouteId)),
                        fetchedAt);
                if (vehicles.isEmpty()) {
                    log.warn("DozoR Uzhhorod returned no valid GPS positions for route {} (id {}, response routes {})",
                            requestedRoute, dozorRouteId, vehicleSource.path("data").size());
                }
                Snapshot fresh = new Snapshot(requestedRoute, true, false, fetchedAt, vehicles);
                snapshot = fresh;
                return fresh;
            } catch (RuntimeException error) {
                log.warn("Official DozoR vehicle feed is unavailable: {}", error.toString());
                if (cached != null && cached.routeNumber().equalsIgnoreCase(requestedRoute)) {
                    return new Snapshot(cached.routeNumber(), true, true, cached.fetchedAt(), cached.vehicles());
                }
                return new Snapshot(requestedRoute, false, false, Instant.now(), List.of());
            }
        }
    }

    /** DozoR labels JSON as octet-stream, so parse its raw bytes ourselves. */
    private JsonNode fetchSource(String query) {
        var request = restClient.get()
                .uri(sourceUrl + query)
                // DozoR serves many cities from one /data endpoint and uses this page context
                // to choose a city's transport feed.
                .header(HttpHeaders.REFERER, sourceReferer)
                .header(HttpHeaders.USER_AGENT, DOZOR_USER_AGENT)
                .header(HttpHeaders.ACCEPT, "application/json, text/javascript, */*; q=0.01")
                .header("X-Requested-With", "XMLHttpRequest");
        String sessionCookie = getSourceSessionCookie();
        if (sessionCookie != null) {
            request.header(HttpHeaders.COOKIE, sessionCookie);
        }
        byte[] source = request.retrieve().body(byte[].class);
        if (source == null || source.length == 0) {
            throw new IllegalArgumentException("The DozoR response is empty");
        }
        try {
            return objectMapper.readTree(source);
        } catch (IOException error) {
            throw new IllegalArgumentException("The DozoR response is not JSON", error);
        }
    }

    /**
     * Opening a city page gives DozoR a short-lived HTTP session. Its /data endpoint uses that
     * session to select the city, while a bare server-to-server /data request may return another
     * city's routes or no positions at all.
     */
    private String getSourceSessionCookie() {
        if (sourceSessionInitialized) {
            return sourceSessionCookie;
        }
        synchronized (this) {
            if (sourceSessionInitialized) {
                return sourceSessionCookie;
            }
            try {
                ResponseEntity<Void> response = restClient.get()
                        .uri(sourceReferer)
                        .header(HttpHeaders.USER_AGENT, DOZOR_USER_AGENT)
                        .retrieve()
                        .toBodilessEntity();
                List<String> cookies = response.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE).stream()
                        .map(TransportVehiclePositionService::cookieValue)
                        .toList();
                sourceSessionCookie = cookies.isEmpty() ? null : String.join("; ", cookies);
            } catch (RuntimeException error) {
                log.warn("Could not initialize the DozoR Uzhhorod session: {}", error.toString());
            } finally {
                sourceSessionInitialized = true;
            }
            return sourceSessionCookie;
        }
    }

    private static String cookieValue(String setCookieHeader) {
        int separator = setCookieHeader.indexOf(';');
        return separator >= 0 ? setCookieHeader.substring(0, separator) : setCookieHeader;
    }

    private boolean isFresh(Snapshot candidate, String requestedRoute) {
        return candidate != null
                && candidate.routeNumber().equalsIgnoreCase(requestedRoute)
                && candidate.fetchedAt().plus(cacheDuration).isAfter(Instant.now());
    }

    private static Long findRouteId(Map<Long, String> routes, String requestedRoute) {
        return routes.entrySet().stream()
                .filter(entry -> entry.getValue().equalsIgnoreCase(requestedRoute))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);
    }

    static Map<Long, String> parseRoutes(JsonNode source) {
        if (source == null || !source.path("data").isArray()) {
            throw new IllegalArgumentException("The DozoR routes response did not return data");
        }
        Map<Long, String> routes = new LinkedHashMap<>();
        for (JsonNode route : source.path("data")) {
            long id = route.path("id").asLong(-1);
            String routeNumber = route.path("sNm").asText().trim();
            if (id > 0 && !routeNumber.isEmpty()) {
                routes.put(id, routeNumber);
            }
        }
        return Map.copyOf(routes);
    }

    static List<TransportVehiclePositionResponse> parseVehicles(
            JsonNode source, Map<Long, String> routeNumbers, Instant fetchedAt) {
        if (source == null || !source.path("data").isArray()) {
            throw new IllegalArgumentException("The DozoR vehicles response did not return data");
        }
        List<TransportVehiclePositionResponse> vehicles = new ArrayList<>();
        for (JsonNode route : source.path("data")) {
            long routeId = route.path("rId").asLong(-1);
            String routeNumber = routeNumbers.get(routeId);
            if (routeNumber == null || !route.path("dvs").isArray()) {
                continue;
            }
            for (JsonNode vehicle : route.path("dvs")) {
                JsonNode location = vehicle.path("loc");
                double latitude = location.path("lat").asDouble(Double.NaN);
                double longitude = location.path("lng").asDouble(Double.NaN);
                if (!isUzhhorodCoordinate(latitude, longitude)) {
                    continue;
                }
                // The provider's device id identifies a tracker, not a public vehicle number.
                // A response-local marker id is enough for the map key and keeps that technical
                // identifier out of the public API.
                String id = "vehicle-" + routeId + "-" + vehicles.size();
                Integer speed = vehicle.path("spd").isNumber() ? vehicle.path("spd").asInt() : null;
                Integer heading = vehicle.path("azi").isNumber()
                        ? Math.floorMod(vehicle.path("azi").asInt(), 360)
                        : null;
                // Deliberately do not expose gNb, device identifiers, or other tracker metadata.
                vehicles.add(new TransportVehiclePositionResponse(
                        id, routeNumber, latitude, longitude, speed, heading, fetchedAt));
            }
        }
        return List.copyOf(vehicles);
    }

    private static boolean isUzhhorodCoordinate(double latitude, double longitude) {
        return Double.isFinite(latitude) && Double.isFinite(longitude)
                && latitude >= -90 && latitude <= 90
                && longitude >= -180 && longitude <= 180
                // A final safety net: never render a third-party GPS point outside Uzhhorod.
                && latitude >= 48.48 && latitude <= 48.75
                && longitude >= 22.10 && longitude <= 22.48;
    }

    private record Snapshot(String routeNumber, boolean available, boolean stale, Instant fetchedAt,
                            List<TransportVehiclePositionResponse> vehicles) {
    }
}
