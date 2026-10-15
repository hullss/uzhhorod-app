package ua.uzhhorod.digital.transport.application;

import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ua.uzhhorod.digital.transport.api.TransportMapPointResponse;
import ua.uzhhorod.digital.transport.api.TransportRouteMapResponse;
import ua.uzhhorod.digital.transport.api.TransportRouteMapVariantResponse;
import ua.uzhhorod.digital.transport.api.TransportStopResponse;
import ua.uzhhorod.digital.transport.domain.TransportRouteRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteShapePointRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantRepository;
import ua.uzhhorod.digital.transport.domain.TransportRouteVariantStopRepository;
import ua.uzhhorod.digital.transport.domain.TransportStopRepository;

@Service
@Transactional(readOnly = true)
public class TransportRouteMapService {

    private final TransportRouteRepository routeRepository;
    private final TransportRouteVariantRepository variantRepository;
    private final TransportRouteVariantStopRepository variantStopRepository;
    private final TransportRouteShapePointRepository shapePointRepository;
    private final TransportStopRepository stopRepository;

    public TransportRouteMapService(
            TransportRouteRepository routeRepository,
            TransportRouteVariantRepository variantRepository,
            TransportRouteVariantStopRepository variantStopRepository,
            TransportRouteShapePointRepository shapePointRepository,
            TransportStopRepository stopRepository) {
        this.routeRepository = routeRepository;
        this.variantRepository = variantRepository;
        this.variantStopRepository = variantStopRepository;
        this.shapePointRepository = shapePointRepository;
        this.stopRepository = stopRepository;
    }

    public TransportRouteMapResponse getMap(UUID routeId) {
        routeRepository.findById(routeId).orElseThrow(() -> new TransportRouteNotFoundException(routeId));
        var variants = variantRepository.findAllByRouteIdOrderByDirectionIdAscNameAsc(routeId);
        var mapVariants = variants.stream()
                .map(variant -> new TransportRouteMapVariantResponse(
                        variant.getId(),
                        variant.getDirectionId(),
                        variant.getName(),
                        shapePointRepository.findAllByIdRouteVariantIdOrderByIdPointSequenceAsc(variant.getId()).stream()
                                .map(point -> new TransportMapPointResponse(point.getLatitude(), point.getLongitude()))
                                .toList()))
                .toList();
        var stopIds = variants.stream()
                .flatMap(variant -> variantStopRepository
                        .findAllByIdRouteVariantIdOrderByIdStopSequenceAsc(variant.getId()).stream())
                .map(variantStop -> variantStop.getStopId()).distinct().toList();
        var byId = stopRepository.findAllById(stopIds).stream()
                .collect(java.util.stream.Collectors.toMap(stop -> stop.getId(), stop -> stop));
        var stops = stopIds.stream()
                .map(id -> java.util.Objects.requireNonNull(byId.get(id), "Missing route stop"))
                .map(stop -> new TransportStopResponse(
                        stop.getId(), stop.getExternalId(), stop.getName(), stop.getLatitude(), stop.getLongitude()))
                .toList();
        return new TransportRouteMapResponse(routeId, mapVariants, stops);
    }
}
