package ua.uzhhorod.digital.transport.api;

import java.util.List;
import java.util.UUID;

public record TransportRouteMapVariantResponse(
        UUID id,
        Integer directionId,
        String name,
        List<TransportMapPointResponse> shape) {
}
