package ua.uzhhorod.digital.transport.api;

import java.time.Instant;

/** A public, privacy-safe representation of one vehicle reported by the city GPS feed. */
public record TransportVehiclePositionResponse(
        String id,
        String routeNumber,
        double latitude,
        double longitude,
        Integer speedKph,
        Integer headingDegrees,
        Instant measuredAt) {
}
