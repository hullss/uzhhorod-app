package ua.uzhhorod.digital.transport.api;

import java.time.Instant;
import java.util.List;

/**
 * Keeps an unavailable real-time source distinct from an empty map: the mobile client must never
 * imply that there are no buses when the provider simply did not respond.
 */
public record TransportVehiclePositionsResponse(
        boolean available,
        boolean stale,
        Instant fetchedAt,
        List<TransportVehiclePositionResponse> vehicles) {
}
