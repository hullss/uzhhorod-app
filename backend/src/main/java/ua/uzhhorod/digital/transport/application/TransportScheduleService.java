package ua.uzhhorod.digital.transport.application;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.uzhhorod.digital.transport.api.TransportDepartureResponse;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarDateRepository;
import ua.uzhhorod.digital.transport.domain.TransportServiceCalendarRepository;
import ua.uzhhorod.digital.transport.domain.TransportTripRepository;
import ua.uzhhorod.digital.transport.domain.TransportTripStopTimeRepository;

@Service
@Transactional(readOnly = true)
public class TransportScheduleService {

    private final TransportTripStopTimeRepository tripStopTimeRepository;
    private final TransportTripRepository tripRepository;
    private final TransportRouteVariantRepository routeVariantRepository;
    private final TransportServiceCalendarRepository calendarRepository;
    private final TransportServiceCalendarDateRepository calendarDateRepository;

    public TransportScheduleService(
            TransportTripStopTimeRepository tripStopTimeRepository,
            TransportTripRepository tripRepository,
            TransportRouteVariantRepository routeVariantRepository,
            TransportServiceCalendarRepository calendarRepository,
            TransportServiceCalendarDateRepository calendarDateRepository) {
        this.tripStopTimeRepository = tripStopTimeRepository;
        this.tripRepository = tripRepository;
        this.routeVariantRepository = routeVariantRepository;
        this.calendarRepository = calendarRepository;
        this.calendarDateRepository = calendarDateRepository;
    }

    public List<TransportDepartureResponse> getDepartures(UUID routeId, UUID stopId, LocalDate date) {
        var stopTimes = tripStopTimeRepository.findAllByRouteIdAndStopId(routeId, stopId);
        var tripIds = stopTimes.stream().map(stopTime -> stopTime.getTripId()).distinct().toList();
        var tripsById = tripRepository.findAllById(tripIds).stream()
                .collect(java.util.stream.Collectors.toMap(trip -> trip.getId(), trip -> trip));
        var serviceIds = tripsById.values().stream().map(trip -> trip.getServiceId()).collect(java.util.stream.Collectors.toSet());
        var activeServices = findActiveServices(serviceIds, date);
        var variantsById = routeVariantRepository.findAllById(
                        tripsById.values().stream().map(trip -> trip.getRouteVariantId()).distinct().toList())
                .stream()
                .collect(java.util.stream.Collectors.toMap(variant -> variant.getId(), variant -> variant));

        return stopTimes.stream()
                .map(stopTime -> new DepartureCandidate(stopTime, tripsById.get(stopTime.getTripId())))
                .filter(candidate -> candidate.departureTimeSeconds() != null)
                .filter(candidate -> candidate.trip() != null && activeServices.getOrDefault(candidate.trip().getServiceId(), false))
                .map(candidate -> {
                    var variant = variantsById.get(candidate.trip().getRouteVariantId());
                    if (variant == null) {
                        return null;
                    }
                    return new TransportDepartureResponse(
                            variant.getId(),
                            variant.getDirectionId(),
                            variant.getName(),
                            formatGtfsTime(candidate.departureTimeSeconds()),
                            candidate.departureTimeSeconds());
                })
                .filter(java.util.Objects::nonNull)
                .toList();
    }

    private Map<String, Boolean> findActiveServices(java.util.Set<String> serviceIds, LocalDate date) {
        var active = new HashMap<String, Boolean>();
        if (serviceIds.isEmpty()) {
            return active;
        }
        calendarRepository.findAllByServiceIdIn(serviceIds)
                .forEach(calendar -> active.put(calendar.getServiceId(), calendar.isActiveOn(date)));
        calendarDateRepository.findAllForDateAndServiceIds(date, serviceIds)
                .forEach(exception -> active.put(exception.getServiceId(), exception.getExceptionType() == 1));
        return active;
    }

    private String formatGtfsTime(int seconds) {
        return String.format("%02d:%02d", seconds / 3600, (seconds % 3600) / 60);
    }

    private record DepartureCandidate(
            ua.uzhhorod.digital.transport.domain.TransportTripStopTime stopTime,
            ua.uzhhorod.digital.transport.domain.TransportTrip trip) {
        Integer departureTimeSeconds() {
            return stopTime.getDepartureTimeSeconds() != null
                    ? stopTime.getDepartureTimeSeconds()
                    : stopTime.getArrivalTimeSeconds();
        }
    }
}
