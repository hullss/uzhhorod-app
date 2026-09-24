package ua.uzhhorod.digital.transport.api;

import java.util.List;
import java.util.UUID;

public record TransportRouteDetailsResponse(
        UUID id,
        String externalId,
        String routeNumber,
        String name,
        boolean active,
        List<TransportRouteVariantResponse> variants) {
}
