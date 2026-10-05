package ua.uzhhorod.digital.cityservices.maps.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.maps.application.SafetyMapPointService;

@RestController
@RequestMapping(path = "/api/city-services/maps", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class SafetyMapController {

    private final SafetyMapPointService mapPointService;

    public SafetyMapController(SafetyMapPointService mapPointService) {
        this.mapPointService = mapPointService;
    }

    @GetMapping("/shelters")
    public SafetyMapPointsResponse getShelters() {
        return mapPointService.getShelters();
    }

    @GetMapping("/resilience")
    public SafetyMapPointsResponse getResiliencePoints() {
        return mapPointService.getResiliencePoints();
    }
}
