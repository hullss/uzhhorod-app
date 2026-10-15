package ua.uzhhorod.digital.cityservices.news.api;

import java.util.List;

/**
 * Plain-text article content, not executable HTML. Preview is retained for older clients.
 */
public record OfficialNewsArticleResponse(
        String title,
        String sourceUrl,
        String publishedLabel,
        String preview,
        List<Block> blocks,
        List<Link> links,
        String imageUrl,
        boolean fullTextAvailable) {

    public record Block(String type, String text) {}
    public record Link(String title, String url) {}
}
