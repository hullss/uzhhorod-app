package ua.uzhhorod.digital.transport.api;

import java.util.UUID;

public record TransportRouteResponse(
        UUID id,
        String externalId,
        String routeNumber,
        String name,
        boolean active) {
}
