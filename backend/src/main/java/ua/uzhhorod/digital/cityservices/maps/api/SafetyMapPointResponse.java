package ua.uzhhorod.digital.cityservices.maps.api;

public record SafetyMapPointResponse(
        String id,
        String name,
        String address,
        double latitude,
        double longitude,
        String description,
        String sourceUrl,
        String verifiedAt) {
    public SafetyMapPointResponse(String id, String name, String address, double latitude, double longitude) {
        this(id, name, address, latitude, longitude, null, null, null);
    }
}
