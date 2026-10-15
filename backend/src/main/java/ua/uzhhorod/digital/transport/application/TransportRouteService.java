package ua.uzhhorod.digital.transport.application;

import java.util.List;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.uzhhorod.digital.transport.api.TransportRouteResponse;
import ua.uzhhorod.digital.transport.api.TransportRouteDetailsResponse;
import ua.uzhhorod.digital.transport.api.TransportRouteVariantResponse;
import ua.uzhhorod.digital.transport.api.TransportStopResponse;
import ua.uzhhorod.digital.transport.domain.TransportRouteRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportStopRepository;

@Service
@Transactional(readOnly = true)
public class TransportRouteService {

    private final TransportRouteRepository routeRepository;
    private final TransportStopRepository stopRepository;
    private final TransportRouteVariantRepository routeVariantRepository;
    private final TransportRouteVariantStopRepository routeVariantStopRepository;

    public TransportRouteService(
            TransportRouteRepository routeRepository,
            TransportStopRepository stopRepository,
            TransportRouteVariantRepository routeVariantRepository,
            TransportRouteVariantStopRepository routeVariantStopRepository) {
        this.routeRepository = routeRepository;
        this.stopRepository = stopRepository;
        this.routeVariantRepository = routeVariantRepository;
        this.routeVariantStopRepository = routeVariantStopRepository;
    }

    public List<TransportRouteResponse> getRoutes(String query) {
        var routes = query == null || query.isBlank()
                ? routeRepository.findAllByActiveTrueOrderByRouteNumberAsc()
                : routeRepository.findByActiveTrueAndRouteNumberContainingIgnoreCaseOrActiveTrueAndNameContainingIgnoreCase(
                        query, query);
        return routes.stream()
                .map(route -> new TransportRouteResponse(
                        route.getId(),
                        route.getExternalId(),
                        route.getRouteNumber(),
                        route.getName(),
                        route.isActive()))
                .toList();
    }

    public List<TransportStopResponse> getStops(UUID routeId) {
        return stopRepository.findAllByRouteId(routeId).stream()
                .map(stop -> new TransportStopResponse(
                        stop.getId(),
                        stop.getExternalId(),
                        stop.getName(),
                        stop.getLatitude(),
                        stop.getLongitude()))
                .toList();
    }

    public TransportRouteDetailsResponse getRoute(UUID routeId) {
        var route = routeRepository.findById(routeId)
                .orElseThrow(() -> new TransportRouteNotFoundException(routeId));
        var variants = routeVariantRepository.findAllByRouteIdOrderByDirectionIdAscNameAsc(routeId).stream()
                .map(variant -> {
                    var sequence = routeVariantStopRepository.findAllByIdRouteVariantIdOrderByIdStopSequenceAsc(variant.getId());
                    var stops = stopRepository.findAllById(sequence.stream().map(item -> item.getStopId()).distinct().toList())
                            .stream().collect(Collectors.toMap(item -> item.getId(), Function.identity()));
                    return new TransportRouteVariantResponse(
                        variant.getId(), variant.getDirectionId(), variant.getName(),
                        sequence.stream()
                                .map(item -> java.util.Objects.requireNonNull(stops.get(item.getStopId()), "Missing route stop"))
                                .map(stop -> new TransportStopResponse(
                                        stop.getId(),
                                        stop.getExternalId(),
                                        stop.getName(),
                                        stop.getLatitude(),
                                        stop.getLongitude()))
                                .toList());
                })
                .toList();
        return new TransportRouteDetailsResponse(
                route.getId(),
                route.getExternalId(),
                route.getRouteNumber(),
                route.getName(),
                route.isActive(),
                variants);
    }
}
