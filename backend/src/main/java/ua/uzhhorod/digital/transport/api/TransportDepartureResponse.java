package ua.uzhhorod.digital.transport.api;

import java.util.UUID;

public record TransportDepartureResponse(
        UUID routeVariantId,
        Integer directionId,
        String destination,
        String departureTime,
        int departureTimeSeconds) {
}
