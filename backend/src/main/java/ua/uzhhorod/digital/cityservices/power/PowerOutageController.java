package ua.uzhhorod.digital.cityservices.power;

import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/city-services/power")
public class PowerOutageController {
    private final PowerOutageService service;
    public PowerOutageController(PowerOutageService service) { this.service = service; }
    @GetMapping("/cities") public List<PowerOutageService.Place> cities() { return service.cities(); }
    @GetMapping("/streets") public List<PowerOutageService.Place> streets(@RequestParam int cityId) { return service.streets(cityId); }
    @GetMapping("/status") public PowerOutageService.Status status(@RequestParam int cityId, @RequestParam int streetId, @RequestParam String building) {
        if (building.length() > 24) throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST);
        return service.status(cityId, streetId, building);
    }
}
