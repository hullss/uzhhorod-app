package ua.uzhhorod.digital.cityservices.miniatures.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.miniatures.application.MiniSculptureCatalogService;

@RestController
@RequestMapping(path = "/api/city-services/miniatures", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class MiniSculptureController {

    private final MiniSculptureCatalogService catalogService;

    public MiniSculptureController(MiniSculptureCatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping
    public MiniSculptureListResponse getCatalog() {
        return catalogService.getCatalog();
    }
}
