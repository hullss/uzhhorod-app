package ua.uzhhorod.digital.transport.api;

import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import ua.uzhhorod.digital.transport.application.TransportRouteService;
import ua.uzhhorod.digital.transport.application.GtfsRouteImportService;
import ua.uzhhorod.digital.transport.application.TransportStopService;
import ua.uzhhorod.digital.transport.application.TransportScheduleService;
import ua.uzhhorod.digital.transport.application.TransportRouteMapService;
import ua.uzhhorod.digital.transport.application.TransportImportRunService;

@RestController
@RequestMapping(path = "/api/transport", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class TransportStatusController {

    private final TransportRouteService routeService;
    private final TransportStopService stopService;
    private final TransportScheduleService scheduleService;
    private final TransportRouteMapService routeMapService;
    private final TransportImportRunService importRunService;
    private final GtfsRouteImportService gtfsRouteImportService;
    private final String importToken;

    public TransportStatusController(
            TransportRouteService routeService,
            TransportStopService stopService,
            TransportScheduleService scheduleService,
            TransportRouteMapService routeMapService,
            TransportImportRunService importRunService,
            GtfsRouteImportService gtfsRouteImportService,
            @Value("${transport.import-token:}") String importToken) {
        this.routeService = routeService;
        this.stopService = stopService;
        this.scheduleService = scheduleService;
        this.routeMapService = routeMapService;
        this.importRunService = importRunService;
        this.gtfsRouteImportService = gtfsRouteImportService;
        this.importToken = importToken;
    }

    @GetMapping("/status")
    public Map<String, String> status() {
        return Map.of("status", "available");
    }

    @GetMapping("/imports/latest")
    public TransportImportStatusResponse getLatestImport() {
        return importRunService.getLatestCompleted()
                .map(run -> new TransportImportStatusResponse(
                        true,
                        run.getFinishedAt(),
                        run.getImportedRouteCount(),
                        run.getImportedStopCount(),
                        run.getImportedRouteStopCount(),
                        run.getImportedRouteVariantCount()))
                .orElseGet(() -> new TransportImportStatusResponse(false, null, null, null, null, null));
    }

    @GetMapping("/routes")
    public List<TransportRouteResponse> getRoutes(
            @RequestParam(required = false) String query) {
        return routeService.getRoutes(query);
    }

    @GetMapping("/routes/{routeId}")
    public TransportRouteDetailsResponse getRoute(@PathVariable UUID routeId) {
        return routeService.getRoute(routeId);
    }

    @GetMapping("/routes/{routeId}/stops")
    public List<TransportStopResponse> getRouteStops(@PathVariable UUID routeId) {
        return routeService.getStops(routeId);
    }

    @GetMapping("/routes/{routeId}/stops/{stopId}/departures")
    public List<TransportDepartureResponse> getDepartures(
            @PathVariable UUID routeId,
            @PathVariable UUID stopId,
            @RequestParam LocalDate date) {
        return scheduleService.getDepartures(routeId, stopId, date);
    }

    @GetMapping("/routes/{routeId}/map")
    public TransportRouteMapResponse getRouteMap(@PathVariable UUID routeId) {
        return routeMapService.getMap(routeId);
    }

    @GetMapping("/stops")
    public List<TransportStopResponse> getStops(@RequestParam(required = false) String query) {
        return stopService.getStops(query);
    }

    @GetMapping("/stops/{stopId}/routes")
    public List<TransportRouteResponse> getStopRoutes(@PathVariable UUID stopId) {
        return stopService.getRoutes(stopId);
    }

    @PostMapping("/imports/gtfs")
    public GtfsImportResponse importGtfsRoutes(
            @RequestHeader(value = "X-Transport-Import-Token", required = false) String providedToken) {
        if (!importToken.isBlank() && !tokensMatch(providedToken, importToken)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Invalid transport import token");
        }
        var result = gtfsRouteImportService.importTransportData();
        return new GtfsImportResponse(
                result.importedRouteCount(),
                result.importedStopCount(),
                result.importedRouteStopCount(),
                result.importedRouteVariantCount());
    }

    private boolean tokensMatch(String providedToken, String expectedToken) {
        if (providedToken == null) {
            return false;
        }
        return MessageDigest.isEqual(
                providedToken.getBytes(StandardCharsets.UTF_8),
                expectedToken.getBytes(StandardCharsets.UTF_8));
    }
}
