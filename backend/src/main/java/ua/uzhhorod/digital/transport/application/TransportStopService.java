package ua.uzhhorod.digital.transport.application;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.uzhhorod.digital.transport.api.TransportRouteResponse;
import ua.uzhhorod.digital.transport.api.TransportStopResponse;
import ua.uzhhorod.digital.transport.domain.TransportRouteStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportStop;
import ua.uzhhorod.digital.transport.domain.TransportStopRepository;

@Service
@Transactional(readOnly = true)
public class TransportStopService {

    private final TransportStopRepository stopRepository;
    private final TransportRouteStopRepository routeStopRepository;

    public TransportStopService(
            TransportStopRepository stopRepository,
            TransportRouteStopRepository routeStopRepository) {
        this.stopRepository = stopRepository;
        this.routeStopRepository = routeStopRepository;
    }

    public List<TransportStopResponse> getStops(String query) {
        var stops = query == null || query.isBlank()
                ? stopRepository.findAll()
                : stopRepository.findByNameContainingIgnoreCaseOrderByNameAsc(query);
        return stops.stream().map(this::toResponse).toList();
    }

    public List<TransportRouteResponse> getRoutes(UUID stopId) {
        if (!stopRepository.existsById(stopId)) {
            throw new TransportStopNotFoundException(stopId);
        }
        return routeStopRepository.findRoutesByStopId(stopId).stream()
                .map(route -> new TransportRouteResponse(
                        route.getId(),
                        route.getExternalId(),
                        route.getRouteNumber(),
                        route.getName(),
                        route.isActive()))
                .toList();
    }

    private TransportStopResponse toResponse(TransportStop stop) {
        return new TransportStopResponse(
                stop.getId(),
                stop.getExternalId(),
                stop.getName(),
                stop.getLatitude(),
                stop.getLongitude());
    }
}
