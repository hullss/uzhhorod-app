package ua.uzhhorod.digital.cityservices.news.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ua.uzhhorod.digital.cityservices.news.application.OfficialNewsService;

@RestController
@RequestMapping(path = "/api/city-services/news", produces = MediaType.APPLICATION_JSON_VALUE + ";charset=UTF-8")
public class OfficialNewsController {

    private final OfficialNewsService officialNewsService;

    public OfficialNewsController(OfficialNewsService officialNewsService) {
        this.officialNewsService = officialNewsService;
    }

    @GetMapping
    public OfficialNewsListResponse getNews(@RequestParam(defaultValue = "false") boolean refresh) {
        return officialNewsService.getNews(refresh);
    }

    @GetMapping("/article")
    public OfficialNewsArticleResponse getArticlePreview(
            @RequestParam String url,
            @RequestParam(required = false) String publishedLabel) {
        return officialNewsService.getArticlePreview(url, publishedLabel);
    }
}
