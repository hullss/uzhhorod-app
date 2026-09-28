package ua.uzhhorod.digital.cityservices.news.application;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsItemResponse;

final class OfficialNewsParser {

    private static final int DATE_SCAN_LENGTH = 320;
    private static final Pattern POST_LINK = Pattern.compile(
            "(?is)<a\\b[^>]*\\bhref\\s*=\\s*(['\\\"])(?<href>[^'\\\"]*/post/[^'\\\"]*)\\1[^>]*>(?<title>.*?)</a>");
    private static final Pattern UKRAINIAN_DATE = Pattern.compile(
            "(?iu)(?:січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\\s+\\d{1,2},\\s+\\d{4}");
    private static final Pattern TAGS = Pattern.compile("(?is)<[^>]+>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private OfficialNewsParser() {
    }

    static List<OfficialNewsItemResponse> parse(String html, String sourceUrl) {
        URI sourceUri = URI.create(sourceUrl);
        Map<String, OfficialNewsItemResponse> distinctItems = new LinkedHashMap<>();
        Matcher linkMatcher = POST_LINK.matcher(html);

        while (linkMatcher.find()) {
            String title = textContent(linkMatcher.group("title"));
            if (title.isBlank()) {
                continue;
            }
            String postUrl = sourceUri.resolve(linkMatcher.group("href")).toString();
            String publishedLabel = findPublishedLabel(html, linkMatcher.end());
            distinctItems.putIfAbsent(postUrl, new OfficialNewsItemResponse(title, postUrl, publishedLabel));
        }
        return List.copyOf(distinctItems.values());
    }

    private static String findPublishedLabel(String html, int fromIndex) {
        int toIndex = Math.min(html.length(), fromIndex + DATE_SCAN_LENGTH);
        Matcher dateMatcher = UKRAINIAN_DATE.matcher(textContent(html.substring(fromIndex, toIndex)));
        return dateMatcher.find() ? dateMatcher.group() : null;
    }

    private static String textContent(String value) {
        return WHITESPACE.matcher(decodeHtml(TAGS.matcher(value).replaceAll(" "))).replaceAll(" ").trim();
    }

    private static String decodeHtml(String value) {
        return value
                .replace("&nbsp;", " ")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&apos;", "'")
                .replace("&amp;", "&")
                .replace("&laquo;", "«")
                .replace("&raquo;", "»");
    }
}
