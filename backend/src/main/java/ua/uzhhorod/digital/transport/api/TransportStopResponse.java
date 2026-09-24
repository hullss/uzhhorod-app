package ua.uzhhorod.digital.transport.api;

import java.util.UUID;

public record TransportStopResponse(
        UUID id,
        String externalId,
        String name,
        double latitude,
        double longitude) {
}
