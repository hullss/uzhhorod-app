package ua.uzhhorod.digital.cityservices.maps.api;

public record SafetyMapPointResponse(
        String id,
        String name,
        String address,
        double latitude,
        double longitude) {
}
