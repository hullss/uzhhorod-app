package ua.uzhhorod.digital.cityservices.news.api;

public record OfficialNewsItemResponse(
        String title,
        String sourceUrl,
        String publishedLabel) {
}
