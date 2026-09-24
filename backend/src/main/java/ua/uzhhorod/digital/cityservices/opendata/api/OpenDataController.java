package ua.uzhhorod.digital.cityservices.opendata.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.opendata.application.OpenDataDatasetService;

@RestController
@RequestMapping(path = "/api/city-services/open-data", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class OpenDataController {

    private final OpenDataDatasetService openDataDatasetService;

    public OpenDataController(OpenDataDatasetService openDataDatasetService) {
        this.openDataDatasetService = openDataDatasetService;
    }

    @GetMapping("/datasets")
    public OpenDataDatasetListResponse getLatestDatasets() {
        return openDataDatasetService.getLatestDatasets();
    }
}
