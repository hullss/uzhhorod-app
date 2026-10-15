package ua.uzhhorod.digital.cityservices.accessibility.application;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import ua.uzhhorod.digital.cityservices.accessibility.api.AccessibleBuildingResponse;

final class AccessibleBuildingParser {

    private AccessibleBuildingParser() {
    }

    static AccessibleBuildingResponse parse(JsonNode record) {
        String buildingName = value(record, "buildingName");
        String entityName = value(record, "entityName");
        String name = buildingName.isBlank() ? entityName : entityName.isBlank() || entityName.equals(buildingName)
                ? buildingName
                : entityName + " — " + buildingName;

        return new AccessibleBuildingResponse(
                identifier(record, name),
                name.isBlank() ? "Будівля без назви" : name,
                address(record),
                parseDate(value(record, "date")));
    }

    private static String identifier(JsonNode record, String name) {
        String id = value(record, "buildingId");
        if (!id.isBlank()) return id;
        String rowId = value(record, "_id");
        if (!rowId.isBlank()) return "ckan-" + rowId;
        String identity = name + "\n" + address(record) + "\n" + value(record, "date");
        return "building-" + java.util.UUID.nameUUIDFromBytes(identity.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private static String address(JsonNode record) {
        List<String> parts = new ArrayList<>();
        addIfPresent(parts, value(record, "addressLocatorDesignator"));
        addIfPresent(parts, value(record, "addressThoroughfare"));
        addIfPresent(parts, value(record, "addressLocatorBuilding"));
        addIfPresent(parts, value(record, "addressLocatorDesignatorBuilding"));
        return parts.isEmpty() ? "Адреса не вказана" : String.join(" ", parts);
    }

    private static LocalDate parseDate(String value) {
        if (value.length() < 10) {
            return null;
        }
        try {
            return LocalDate.parse(value.substring(0, 10));
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static void addIfPresent(List<String> values, String value) {
        if (!value.isBlank()) {
            values.add(value);
        }
    }

    private static String value(JsonNode record, String field) {
        JsonNode value = record.path(field);
        return value.isMissingNode() || value.isNull() ? "" : value.asText().trim();
    }
}
