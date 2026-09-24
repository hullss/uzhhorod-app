package ua.uzhhorod.digital.transport.api;

import java.util.List;
import java.util.UUID;

public record TransportRouteMapResponse(
        UUID routeId,
        List<TransportRouteMapVariantResponse> variants,
        List<TransportStopResponse> stops) {
}
