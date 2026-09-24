package ua.uzhhorod.digital.transport.api;

import java.util.List;
import java.util.UUID;

public record TransportRouteVariantResponse(
        UUID id,
        Integer directionId,
        String name,
        List<TransportStopResponse> stops) {
}
