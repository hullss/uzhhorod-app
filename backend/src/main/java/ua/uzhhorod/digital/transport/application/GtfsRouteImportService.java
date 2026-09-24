package ua.uzhhorod.digital.transport.application;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipInputStream;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.uzhhorod.digital.transport.domain.TransportRoute;
import ua.uzhhorod.digital.transport.domain.TransportRouteRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteStop;
import ua.uzhhorod.digital.transport.domain.TransportRouteStopId;
import ua.uzhhorod.digital.transport.domain.TransportRouteStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariant;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantStop;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteShapePoint;
import ua.uzhhorod.digital.transport.domain.TransportRouteShapePointRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendar;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarDate;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarDateRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarRepository;
import ua.uzhhorod.digital.transport.domain.TransportStop;
import ua.uzhhorod.digital.transport.domain.TransportStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportTrip;
import ua.uzhhorod.digital.transport.domain.TransportTripRepository;
import ua.uzhhorod.digital.transport.domain.TransportTripStopTime;
import ua.uzhhorod.digital.transport.domain.TransportTripStopTimeRepository;

@Service
public class GtfsRouteImportService {

    private final TransportRouteRepository routeRepository;
    private final TransportStopRepository stopRepository;
    private final TransportRouteStopRepository routeStopRepository;
    private final TransportRouteVariantRepository routeVariantRepository;
    private final TransportRouteVariantStopRepository routeVariantStopRepository;
    private final TransportRouteShapePointRepository routeShapePointRepository;
    private final TransportTripRepository tripRepository;
    private final TransportTripStopTimeRepository tripStopTimeRepository;
    private final TransportServiceCalendarRepository calendarRepository;
    private final TransportServiceCalendarDateRepository calendarDateRepository;
    private final TransportImportRunService importRunService;
    private final HttpClient httpClient;
    private final URI feedUri;
    private final AtomicBoolean importInProgress = new AtomicBoolean(false);

    public GtfsRouteImportService(
            TransportRouteRepository routeRepository,
            TransportStopRepository stopRepository,
            TransportRouteStopRepository routeStopRepository,
            TransportRouteVariantRepository routeVariantRepository,
            TransportRouteVariantStopRepository routeVariantStopRepository,
            TransportRouteShapePointRepository routeShapePointRepository,
            TransportTripRepository tripRepository,
            TransportTripStopTimeRepository tripStopTimeRepository,
            TransportServiceCalendarRepository calendarRepository,
            TransportServiceCalendarDateRepository calendarDateRepository,
            TransportImportRunService importRunService,
            @Value("${transport.gtfs-feed-url}") String feedUrl) {
        this.routeRepository = routeRepository;
        this.stopRepository = stopRepository;
        this.routeStopRepository = routeStopRepository;
        this.routeVariantRepository = routeVariantRepository;
        this.routeVariantStopRepository = routeVariantStopRepository;
        this.routeShapePointRepository = routeShapePointRepository;
        this.tripRepository = tripRepository;
        this.tripStopTimeRepository = tripStopTimeRepository;
        this.calendarRepository = calendarRepository;
        this.calendarDateRepository = calendarDateRepository;
        this.importRunService = importRunService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        this.feedUri = URI.create(feedUrl);
    }

    @Transactional
    public GtfsImportResult importTransportData() {
        if (!importInProgress.compareAndSet(false, true)) {
            throw new IllegalStateException("A GTFS import is already in progress");
        }
        try {
            var runId = importRunService.start(feedUri.toString());
            try {
                var result = importTransportDataFromArchive(downloadFeed());
                importRunService.complete(runId, result);
                return result;
            } catch (RuntimeException exception) {
                importRunService.fail(runId, exception);
                throw exception;
            }
        } finally {
            importInProgress.set(false);
        }
    }

    private byte[] downloadFeed() {
        var request = HttpRequest.newBuilder(feedUri)
                .timeout(Duration.ofSeconds(30))
                .GET()
                .build();
        try {
            var response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("GTFS feed returned HTTP " + response.statusCode());
            }
            return response.body();
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to download the GTFS feed", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("GTFS feed download was interrupted", exception);
        }
    }

    GtfsImportResult importTransportDataFromArchive(byte[] archive) {
        var feed = readFeed(archive);
        var routeIds = importRoutes(feed.routes());
        var stopIds = importStops(feed.stops());
        var routeStopCount = importRouteStops(feed.trips(), feed.stopTimes(), routeIds, stopIds);
        var variantIds = importRouteVariants(feed.trips(), feed.stopTimes(), routeIds, stopIds);
        importRouteShapes(feed.trips(), feed.shapes(), variantIds);
        importCalendars(feed.calendars(), feed.calendarDates());
        importTrips(feed.trips(), feed.stopTimes(), variantIds, stopIds);
        return new GtfsImportResult(routeIds.size(), stopIds.size(), routeStopCount, variantIds.size());
    }

    private GtfsFeed readFeed(byte[] archive) {
        var routes = new LinkedHashMap<String, GtfsRoute>();
        var stops = new LinkedHashMap<String, GtfsStop>();
        var trips = new LinkedHashMap<String, GtfsTrip>();
        var stopTimes = new LinkedHashMap<String, List<GtfsStopTime>>();
        var calendars = new LinkedHashMap<String, GtfsCalendar>();
        var calendarDates = new ArrayList<GtfsCalendarDate>();
        var shapes = new LinkedHashMap<String, List<GtfsShapePoint>>();
        try (var zipInput = new ZipInputStream(new ByteArrayInputStream(archive))) {
            for (var entry = zipInput.getNextEntry(); entry != null; entry = zipInput.getNextEntry()) {
                var contents = zipInput.readAllBytes();
                switch (entry.getName()) {
                    case "routes.txt" -> readRoutes(contents, routes);
                    case "stops.txt" -> readStops(contents, stops);
                    case "trips.txt" -> readTrips(contents, trips);
                    case "stop_times.txt" -> readStopTimes(contents, stopTimes);
                    case "calendar.txt" -> readCalendars(contents, calendars);
                    case "calendar_dates.txt" -> readCalendarDates(contents, calendarDates);
                    case "shapes.txt" -> readShapes(contents, shapes);
                    default -> {
                    }
                }
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read the GTFS archive", exception);
        }
        if (routes.isEmpty()) {
            throw new IllegalStateException("The GTFS archive does not contain routes.txt");
        }
        return new GtfsFeed(routes, stops, trips, stopTimes, calendars, calendarDates, shapes);
    }

    private void readRoutes(byte[] contents, Map<String, GtfsRoute> routes) {
        forEachRecord(contents, record -> {
            var externalId = record.get("route_id");
            routes.put(externalId, new GtfsRoute(
                    externalId,
                    firstNonBlank(record.get("route_short_name"), record.get("route_long_name"), externalId),
                    firstNonBlank(record.get("route_long_name"), record.get("route_short_name"), externalId)));
        });
    }

    private void readStops(byte[] contents, Map<String, GtfsStop> stops) {
        forEachRecord(contents, record -> {
            var externalId = record.get("stop_id");
            stops.put(externalId, new GtfsStop(
                    externalId,
                    firstNonBlank(record.get("stop_name"), externalId),
                    Double.parseDouble(record.get("stop_lat")),
                    Double.parseDouble(record.get("stop_lon"))));
        });
    }

    private void readTrips(byte[] contents, Map<String, GtfsTrip> trips) {
        forEachRecord(contents, record -> {
            var tripId = record.get("trip_id");
            trips.put(tripId, new GtfsTrip(
                    tripId,
                    record.get("route_id"),
                    record.get("service_id"),
                    parseOptionalInteger(record.get("direction_id")),
                    record.isMapped("trip_headsign") ? record.get("trip_headsign") : "",
                    record.isMapped("shape_id") ? record.get("shape_id") : ""));
        });
    }

    private void readStopTimes(byte[] contents, Map<String, List<GtfsStopTime>> stopTimes) {
        forEachRecord(contents, record -> stopTimes
                .computeIfAbsent(record.get("trip_id"), ignored -> new ArrayList<>())
                .add(new GtfsStopTime(
                        record.get("stop_id"),
                        Integer.parseInt(record.get("stop_sequence")),
                        parseGtfsTime(record.isMapped("arrival_time") ? record.get("arrival_time") : ""),
                        parseGtfsTime(record.isMapped("departure_time") ? record.get("departure_time") : ""))));
    }

    private void readCalendars(byte[] contents, Map<String, GtfsCalendar> calendars) {
        forEachRecord(contents, record -> {
            var serviceId = record.get("service_id");
            calendars.put(serviceId, new GtfsCalendar(
                    serviceId,
                    "1".equals(record.get("monday")),
                    "1".equals(record.get("tuesday")),
                    "1".equals(record.get("wednesday")),
                    "1".equals(record.get("thursday")),
                    "1".equals(record.get("friday")),
                    "1".equals(record.get("saturday")),
                    "1".equals(record.get("sunday")),
                    parseGtfsDate(record.get("start_date")),
                    parseGtfsDate(record.get("end_date"))));
        });
    }

    private void readCalendarDates(byte[] contents, List<GtfsCalendarDate> calendarDates) {
        forEachRecord(contents, record -> calendarDates.add(new GtfsCalendarDate(
                record.get("service_id"),
                parseGtfsDate(record.get("date")),
                Integer.parseInt(record.get("exception_type")))));
    }

    private void readShapes(byte[] contents, Map<String, List<GtfsShapePoint>> shapes) {
        forEachRecord(contents, record -> shapes
                .computeIfAbsent(record.get("shape_id"), ignored -> new ArrayList<>())
                .add(new GtfsShapePoint(
                        Integer.parseInt(record.get("shape_pt_sequence")),
                        Double.parseDouble(record.get("shape_pt_lat")),
                        Double.parseDouble(record.get("shape_pt_lon")))));
    }

    private void forEachRecord(byte[] contents, CsvRecordConsumer consumer) {
        var format = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build();
        try (var reader = new InputStreamReader(new ByteArrayInputStream(contents), StandardCharsets.UTF_8);
                var records = CSVParser.parse(reader, format)) {
            for (CSVRecord record : records) {
                consumer.accept(record);
            }
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read a GTFS CSV file", exception);
        }
    }

    private Map<String, UUID> importRoutes(Map<String, GtfsRoute> routes) {
        var routeIds = new HashMap<String, UUID>();
        for (GtfsRoute route : routes.values()) {
            var storedRoute = routeRepository.findByExternalId(route.externalId())
                    .map(existingRoute -> {
                        existingRoute.update(route.routeNumber(), route.name(), true);
                        return existingRoute;
                    })
                    .orElseGet(() -> routeRepository.save(new TransportRoute(
                            UUID.randomUUID(), route.externalId(), route.routeNumber(), route.name(), true)));
            routeIds.put(route.externalId(), storedRoute.getId());
        }
        routeRepository.findAll().stream()
                .filter(existingRoute -> !routes.containsKey(existingRoute.getExternalId()))
                .filter(TransportRoute::isActive)
                .forEach(existingRoute -> existingRoute.update(
                        existingRoute.getRouteNumber(), existingRoute.getName(), false));
        return routeIds;
    }

    private Map<String, UUID> importStops(Map<String, GtfsStop> stops) {
        var stopIds = new HashMap<String, UUID>();
        for (GtfsStop stop : stops.values()) {
            var storedStop = stopRepository.findByExternalId(stop.externalId())
                    .map(existingStop -> {
                        existingStop.update(stop.name(), stop.latitude(), stop.longitude());
                        return existingStop;
                    })
                    .orElseGet(() -> stopRepository.save(new TransportStop(
                            UUID.randomUUID(), stop.externalId(), stop.name(), stop.latitude(), stop.longitude())));
            stopIds.put(stop.externalId(), storedStop.getId());
        }
        return stopIds;
    }

    private int importRouteStops(
            Map<String, GtfsTrip> trips,
            Map<String, List<GtfsStopTime>> stopTimes,
            Map<String, UUID> routeIds,
            Map<String, UUID> stopIds) {
        var importedCount = 0;
        var importedLinks = new HashSet<String>();
        for (var tripEntry : stopTimes.entrySet()) {
            var trip = trips.get(tripEntry.getKey());
            var routeId = trip == null ? null : routeIds.get(trip.routeExternalId());
            if (routeId == null) {
                continue;
            }
            for (GtfsStopTime stopTime : tripEntry.getValue()) {
                var stopId = stopIds.get(stopTime.stopExternalId());
                if (stopId != null && importedLinks.add(routeId + ":" + stopId)) {
                    var routeStopId = new TransportRouteStopId(routeId, stopId);
                    if (!routeStopRepository.existsById(routeStopId)) {
                        routeStopRepository.save(new TransportRouteStop(routeId, stopId));
                        importedCount++;
                    }
                }
            }
        }
        return importedCount;
    }

    private Map<String, UUID> importRouteVariants(
            Map<String, GtfsTrip> trips,
            Map<String, List<GtfsStopTime>> stopTimes,
            Map<String, UUID> routeIds,
            Map<String, UUID> stopIds) {
        var representativeTrips = new LinkedHashMap<String, String>();
        for (var tripEntry : trips.entrySet()) {
            if (stopTimes.containsKey(tripEntry.getKey())) {
                representativeTrips.putIfAbsent(tripEntry.getValue().variantExternalId(), tripEntry.getKey());
            }
        }

        var variantIds = new HashMap<String, UUID>();
        for (var representativeEntry : representativeTrips.entrySet()) {
            var trip = trips.get(representativeEntry.getValue());
            var routeId = routeIds.get(trip.routeExternalId());
            if (routeId == null) {
                continue;
            }
            var variant = routeVariantRepository.findByExternalId(representativeEntry.getKey())
                    .map(existingVariant -> {
                        existingVariant.update(trip.headsign());
                        return existingVariant;
                    })
                    .orElseGet(() -> routeVariantRepository.save(new TransportRouteVariant(
                            UUID.randomUUID(), representativeEntry.getKey(), routeId, trip.directionId(), trip.headsign())));
            variantIds.put(representativeEntry.getKey(), variant.getId());
            routeVariantStopRepository.deleteByRouteVariantId(variant.getId());
            stopTimes.get(representativeEntry.getValue()).stream()
                    .sorted(Comparator.comparingInt(GtfsStopTime::stopSequence))
                    .map(stopTime -> new StopAtSequence(stopIds.get(stopTime.stopExternalId()), stopTime.stopSequence()))
                    .filter(stopAtSequence -> stopAtSequence.stopId() != null)
                    .forEach(stopAtSequence -> routeVariantStopRepository.save(new TransportRouteVariantStop(
                            variant.getId(), stopAtSequence.stopId(), stopAtSequence.stopSequence())));
        }
        return variantIds;
    }

    private void importCalendars(
            Map<String, GtfsCalendar> calendars,
            List<GtfsCalendarDate> calendarDates) {
        calendarDateRepository.deleteAllInBatch();
        calendarRepository.deleteAllInBatch();
        calendars.values().forEach(calendar -> calendarRepository.save(new TransportServiceCalendar(
                calendar.serviceId(),
                calendar.monday(),
                calendar.tuesday(),
                calendar.wednesday(),
                calendar.thursday(),
                calendar.friday(),
                calendar.saturday(),
                calendar.sunday(),
                calendar.startDate(),
                calendar.endDate())));
        calendarDates.forEach(calendarDate -> calendarDateRepository.save(new TransportServiceCalendarDate(
                calendarDate.serviceId(), calendarDate.date(), calendarDate.exceptionType())));
    }

    private void importRouteShapes(
            Map<String, GtfsTrip> trips,
            Map<String, List<GtfsShapePoint>> shapes,
            Map<String, UUID> variantIds) {
        var representativeTrips = new LinkedHashMap<String, GtfsTrip>();
        trips.values().forEach(trip -> representativeTrips.putIfAbsent(trip.variantExternalId(), trip));
        representativeTrips.forEach((variantExternalId, trip) -> {
            var variantId = variantIds.get(variantExternalId);
            if (variantId == null) {
                return;
            }
            routeShapePointRepository.deleteByRouteVariantId(variantId);
            shapes.getOrDefault(trip.shapeId(), List.of()).stream()
                    .sorted(Comparator.comparingInt(GtfsShapePoint::sequence))
                    .forEach(point -> routeShapePointRepository.save(new TransportRouteShapePoint(
                            variantId, point.sequence(), point.latitude(), point.longitude())));
        });
    }

    private void importTrips(
            Map<String, GtfsTrip> trips,
            Map<String, List<GtfsStopTime>> stopTimes,
            Map<String, UUID> variantIds,
            Map<String, UUID> stopIds) {
        tripStopTimeRepository.deleteAllInBatch();
        tripRepository.deleteAllInBatch();
        for (GtfsTrip trip : trips.values()) {
            var variantId = variantIds.get(trip.variantExternalId());
            if (variantId == null || !stopTimes.containsKey(trip.externalId())) {
                continue;
            }
            var storedTrip = tripRepository.save(new TransportTrip(
                    UUID.randomUUID(), trip.externalId(), variantId, trip.serviceId()));
            for (GtfsStopTime stopTime : stopTimes.get(trip.externalId())) {
                var stopId = stopIds.get(stopTime.stopExternalId());
                if (stopId != null) {
                    tripStopTimeRepository.save(new TransportTripStopTime(
                            storedTrip.getId(),
                            stopId,
                            stopTime.stopSequence(),
                            stopTime.arrivalTimeSeconds(),
                            stopTime.departureTimeSeconds()));
                }
            }
        }
    }

    private Integer parseOptionalInteger(String value) {
        return value == null || value.isBlank() ? null : Integer.parseInt(value);
    }

    private Integer parseGtfsTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        var parts = value.split(":");
        if (parts.length != 3) {
            throw new IllegalArgumentException("Invalid GTFS time: " + value);
        }
        return Integer.parseInt(parts[0]) * 3600
                + Integer.parseInt(parts[1]) * 60
                + Integer.parseInt(parts[2]);
    }

    private LocalDate parseGtfsDate(String value) {
        return LocalDate.parse(value, DateTimeFormatter.BASIC_ISO_DATE);
    }

    private String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        throw new IllegalArgumentException("GTFS record is missing identifying values");
    }

    private record GtfsFeed(
            Map<String, GtfsRoute> routes,
            Map<String, GtfsStop> stops,
            Map<String, GtfsTrip> trips,
            Map<String, List<GtfsStopTime>> stopTimes,
            Map<String, GtfsCalendar> calendars,
            List<GtfsCalendarDate> calendarDates,
            Map<String, List<GtfsShapePoint>> shapes) {
    }

    private record GtfsRoute(String externalId, String routeNumber, String name) {
    }

    private record GtfsStop(String externalId, String name, double latitude, double longitude) {
    }

    private record GtfsTrip(
            String externalId,
            String routeExternalId,
            String serviceId,
            Integer directionId,
            String headsign,
            String shapeId) {
        String variantExternalId() {
            return routeExternalId + "|" + directionId + "|" + headsign + "|" + shapeId;
        }
    }

    private record GtfsStopTime(
            String stopExternalId,
            int stopSequence,
            Integer arrivalTimeSeconds,
            Integer departureTimeSeconds) {
    }

    private record GtfsCalendar(
            String serviceId,
            boolean monday,
            boolean tuesday,
            boolean wednesday,
            boolean thursday,
            boolean friday,
            boolean saturday,
            boolean sunday,
            LocalDate startDate,
            LocalDate endDate) {
    }

    private record GtfsCalendarDate(String serviceId, LocalDate date, int exceptionType) {
    }

    private record GtfsShapePoint(int sequence, double latitude, double longitude) {
    }

    private record StopAtSequence(UUID stopId, int stopSequence) {
    }

    public record GtfsImportResult(
            int importedRouteCount,
            int importedStopCount,
            int importedRouteStopCount,
            int importedRouteVariantCount) {
    }

    @FunctionalInterface
    private interface CsvRecordConsumer {
        void accept(CSVRecord record);
    }
}
