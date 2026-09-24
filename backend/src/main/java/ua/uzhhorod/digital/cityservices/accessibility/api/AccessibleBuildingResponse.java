package ua.uzhhorod.digital.cityservices.accessibility.api;

import java.time.LocalDate;

public record AccessibleBuildingResponse(
        String id,
        String name,
        String address,
        LocalDate monitoredAt) {
}
