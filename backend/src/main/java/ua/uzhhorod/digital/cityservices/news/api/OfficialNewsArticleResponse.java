package ua.uzhhorod.digital.cityservices.news.api;

/**
 * A short attributed preview of an official post. The complete original remains on the council site.
 */
public record OfficialNewsArticleResponse(
        String title,
        String sourceUrl,
        String publishedLabel,
        String preview) {
}
