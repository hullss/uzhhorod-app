package ua.uzhhorod.digital.transport.api;

public record GtfsImportResponse(
        int importedRouteCount,
        int importedStopCount,
        int importedRouteStopCount,
        int importedRouteVariantCount) {
}
