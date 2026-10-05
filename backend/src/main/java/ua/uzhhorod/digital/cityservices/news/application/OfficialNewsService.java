package ua.uzhhorod.digital.cityservices.news.application;

import java.time.Duration;
import java.time.Instant;
import java.net.URI;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsItemResponse;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsListResponse;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsArticleResponse;

@Service
public class OfficialNewsService {

    private final RestClient restClient;
    private final String sourceUrl;
    private final Duration cacheDuration;
    private volatile Snapshot snapshot;

    public OfficialNewsService(
            RestClient.Builder restClientBuilder,
            @Value("${city-services.news.source-url}") String sourceUrl,
            @Value("${city-services.news.cache-duration:PT10M}") Duration cacheDuration) {
        this.restClient = restClientBuilder.build();
        this.sourceUrl = sourceUrl;
        this.cacheDuration = cacheDuration;
    }

    public OfficialNewsListResponse getNews(boolean forceRefresh) {
        Snapshot current = currentSnapshot(forceRefresh);
        return new OfficialNewsListResponse(current.fetchedAt(), current.stale(), current.items());
    }

    public OfficialNewsArticleResponse getArticlePreview(String articleUrl, String publishedLabel) {
        URI articleUri = validateArticleUri(articleUrl);
        try {
            String articleHtml = restClient.get()
                    .uri(articleUri)
                    .header(HttpHeaders.USER_AGENT, "UzhhorodDigital/1.0")
                    .retrieve()
                    .body(String.class);
            return OfficialNewsParser.parseArticle(articleHtml == null ? "" : articleHtml, articleUri.toString(), publishedLabel);
        } catch (RuntimeException error) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Official article is temporarily unavailable", error);
        }
    }

    private URI validateArticleUri(String articleUrl) {
        try {
            URI sourceUri = URI.create(sourceUrl);
            URI articleUri = URI.create(articleUrl);
            String articlePath = articleUri.getPath();
            if (!"https".equalsIgnoreCase(articleUri.getScheme())
                    || !sourceUri.getHost().equalsIgnoreCase(articleUri.getHost())
                    || (articleUri.getPort() != -1 && articleUri.getPort() != sourceUri.getPort())
                    || articlePath == null
                    || !articlePath.startsWith("/post/")) {
                throw new IllegalArgumentException("Unexpected official news article URL");
            }
            return articleUri;
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Article URL must belong to the official council news section");
        }
    }

    private Snapshot currentSnapshot(boolean forceRefresh) {
        Snapshot cached = snapshot;
        if (!forceRefresh && cached != null && cached.fetchedAt().plus(cacheDuration).isAfter(Instant.now())) {
            return cached;
        }

        synchronized (this) {
            cached = snapshot;
            if (!forceRefresh && cached != null && cached.fetchedAt().plus(cacheDuration).isAfter(Instant.now())) {
                return cached;
            }
            try {
                String sourceHtml = restClient.get()
                        .uri(sourceUrl)
                        .header(HttpHeaders.USER_AGENT, "UzhhorodDigital/1.0")
                        .retrieve()
                        .body(String.class);
                List<OfficialNewsItemResponse> items = OfficialNewsParser.parse(sourceHtml == null ? "" : sourceHtml, sourceUrl);
                if (items.isEmpty()) {
                    throw new IllegalStateException("Official news page did not contain any posts");
                }
                snapshot = new Snapshot(Instant.now(), false, items);
                return snapshot;
            } catch (RuntimeException error) {
                if (cached != null) {
                    return new Snapshot(cached.fetchedAt(), true, cached.items());
                }
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "Official news are temporarily unavailable", error);
            }
        }
    }

    private record Snapshot(Instant fetchedAt, boolean stale, List<OfficialNewsItemResponse> items) {
    }
}
