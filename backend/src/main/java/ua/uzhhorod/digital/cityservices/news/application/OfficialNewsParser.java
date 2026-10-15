package ua.uzhhorod.digital.cityservices.news.application;

import java.net.URI;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsArticleResponse;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsItemResponse;

final class OfficialNewsParser {

    private static final int DATE_SCAN_LENGTH = 320;
    private static final Pattern POST_LINK = Pattern.compile(
            "(?is)<a\\b[^>]*\\bhref\\s*=\\s*(['\\\"])(?<href>[^'\\\"]*/post/[^'\\\"]*)\\1[^>]*>(?<title>.*?)</a>");
    private static final Pattern UKRAINIAN_DATE = Pattern.compile(
            "(?iu)(?<month>січня|лютого|березня|квітня|травня|червня|липня|серпня|вересня|жовтня|листопада|грудня)\\s+(?<day>\\d{1,2}),\\s+(?<year>\\d{4})");
    private static final Pattern TAGS = Pattern.compile("(?is)<[^>]+>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    private static final Pattern META_TAG = Pattern.compile("(?is)<meta\\b[^>]*>");
    private static final Pattern CONTENT_ATTRIBUTE = Pattern.compile("(?is)\\bcontent\\s*=\\s*(['\"])(?<content>.*?)\\1");
    private static final Pattern DESCRIPTION_ATTRIBUTE = Pattern.compile("(?is)\\b(?:name|property)\\s*=\\s*(['\"])(?:description|og:description)\\1");
    private static final Pattern ARTICLE = Pattern.compile("(?is)<article\\b[^>]*>(?<content>.*?)</article>");
    private static final Pattern H1 = Pattern.compile("(?is)<h1\\b[^>]*>(?<content>.*?)</h1>");

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
        // The official page renders a few undated pinned posts before the chronological feed.
        // Sort dated items ourselves, otherwise a very old pinned post becomes "important".
        return distinctItems.values().stream()
                .sorted(Comparator.comparing(OfficialNewsParser::publishedDate,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
    }

    static OfficialNewsArticleResponse parseArticle(String html, String sourceUrl, String publishedLabel) {
        String title = firstMatch(H1, html);
        Matcher articleMatcher = ARTICLE.matcher(html);
        String articleHtml = articleMatcher.find() ? articleMatcher.group("content") : "";
        String bodyHtml = OfficialArticleExtractor.body(articleHtml);
        var blocks = OfficialArticleExtractor.blocks(bodyHtml);
        String preview = metaDescription(html);
        if (preview.isBlank()) {
            preview = blocks.stream().map(OfficialNewsArticleResponse.Block::text)
                    .collect(java.util.stream.Collectors.joining("\n\n"));
        }
        Matcher dateMatcher = UKRAINIAN_DATE.matcher(textContent(articleHtml));
        if (dateMatcher.find()) publishedLabel = dateMatcher.group();
        return new OfficialNewsArticleResponse(title, sourceUrl, publishedLabel, trimToLength(preview, 720),
                blocks, OfficialArticleExtractor.links(bodyHtml, sourceUrl),
                OfficialArticleExtractor.image(articleHtml, sourceUrl), !blocks.isEmpty());
    }

    private static String metaDescription(String html) {
        Matcher metaMatcher = META_TAG.matcher(html);
        while (metaMatcher.find()) {
            if (!DESCRIPTION_ATTRIBUTE.matcher(metaMatcher.group()).find()) {
                continue;
            }
            Matcher contentMatcher = CONTENT_ATTRIBUTE.matcher(metaMatcher.group());
            if (contentMatcher.find()) {
                return textContent(contentMatcher.group("content"));
            }
        }
        return "";
    }

    private static String firstMatch(Pattern pattern, String html) {
        Matcher matcher = pattern.matcher(html);
        return matcher.find() ? textContent(matcher.group("content")) : "";
    }

    private static String trimToLength(String value, int maximumLength) {
        if (value.length() <= maximumLength) {
            return value;
        }
        int lastWhitespace = value.lastIndexOf(' ', maximumLength - 1);
        int cutoff = lastWhitespace > maximumLength / 2 ? lastWhitespace : maximumLength;
        return value.substring(0, cutoff).trim() + "…";
    }

    private static String findPublishedLabel(String html, int fromIndex) {
        int toIndex = Math.min(html.length(), fromIndex + DATE_SCAN_LENGTH);
        Matcher nextPost = POST_LINK.matcher(html);
        nextPost.region(fromIndex, toIndex);
        if (nextPost.find()) toIndex = nextPost.start();
        Matcher dateMatcher = UKRAINIAN_DATE.matcher(textContent(html.substring(fromIndex, toIndex)));
        return dateMatcher.find() ? dateMatcher.group() : null;
    }

    private static LocalDate publishedDate(OfficialNewsItemResponse item) {
        if (item.publishedLabel() == null) {
            return null;
        }
        Matcher matcher = UKRAINIAN_DATE.matcher(item.publishedLabel());
        if (!matcher.find()) {
            return null;
        }
        int month = switch (matcher.group("month").toLowerCase(java.util.Locale.ROOT)) {
            case "січня" -> 1;
            case "лютого" -> 2;
            case "березня" -> 3;
            case "квітня" -> 4;
            case "травня" -> 5;
            case "червня" -> 6;
            case "липня" -> 7;
            case "серпня" -> 8;
            case "вересня" -> 9;
            case "жовтня" -> 10;
            case "листопада" -> 11;
            case "грудня" -> 12;
            default -> 0;
        };
        try {
            return month == 0 ? null : LocalDate.of(
                    Integer.parseInt(matcher.group("year")), month, Integer.parseInt(matcher.group("day")));
        } catch (IllegalArgumentException error) {
            return null;
        }
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
