package ua.uzhhorod.digital.cityservices.accessibility.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.accessibility.application.AccessibleBuildingService;

@RestController
@RequestMapping(path = "/api/city-services/accessibility", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class AccessibilityController {

    private final AccessibleBuildingService accessibleBuildingService;

    public AccessibilityController(AccessibleBuildingService accessibleBuildingService) {
        this.accessibleBuildingService = accessibleBuildingService;
    }

    @GetMapping("/buildings")
    public AccessibleBuildingListResponse getBuildings(@RequestParam(required = false) String query) {
        return accessibleBuildingService.getBuildings(query);
    }
}
