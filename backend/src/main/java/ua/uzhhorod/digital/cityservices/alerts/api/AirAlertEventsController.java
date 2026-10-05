package ua.uzhhorod.digital.cityservices.alerts.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.alerts.application.AirAlertStatusService;

@RestController
@RequestMapping(path = "/api/city-services/alerts/events", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class AirAlertEventsController {
    private final AirAlertStatusService service;

    public AirAlertEventsController(AirAlertStatusService service) {
        this.service = service;
    }

    @GetMapping
    public AirAlertEventsResponse getEvents() {
        return service.getEvents();
    }
}
