package ua.uzhhorod.digital.cityservices.news.application;

import java.io.IOException;
import java.io.StringReader;
import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import javax.swing.text.MutableAttributeSet;
import javax.swing.text.html.HTML;
import javax.swing.text.html.HTMLEditorKit;
import javax.swing.text.html.parser.ParserDelegator;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsArticleResponse.Block;
import ua.uzhhorod.digital.cityservices.news.api.OfficialNewsArticleResponse.Link;

/** Isolates the council CMS body; never treats a whole page as an article. */
final class OfficialArticleExtractor {
    private static final Pattern CONTAINER = Pattern.compile("(?is)<(div|section)\\b([^>]*)>");
    private static final Pattern CLASS = Pattern.compile("(?is)\\bclass\\s*=\\s*(['\"])(.*?)\\1");
    private static final Pattern NON_CONTENT = Pattern.compile(
            "(?is)<!--.*?-->|<(script|style|nav|aside|footer|form|iframe|noscript|h1)\\b[^>]*>.*?</\\1\\s*>");
    private static final Pattern IMAGE = Pattern.compile("(?is)<img\\b[^>]*\\bsrc\\s*=\\s*(['\"])(.*?)\\1");

    private OfficialArticleExtractor() {}

    static String body(String articleHtml) {
        var containers = CONTAINER.matcher(articleHtml);
        while (containers.find()) {
            var classes = CLASS.matcher(containers.group(2));
            if (!classes.find() || !List.of(classes.group(2).split("\\s+")).contains("post-item-inner-content")) continue;
            // Match nesting, rather than ending at the first </div> inside the article.
            String tag = containers.group(1);
            var boundaries = Pattern.compile("(?is)</?" + tag + "\\b[^>]*>").matcher(articleHtml);
            boundaries.region(containers.end(), articleHtml.length());
            int depth = 1;
            while (boundaries.find()) {
                depth += boundaries.group().startsWith("</") ? -1 : 1;
                if (depth == 0) return articleHtml.substring(containers.end(), boundaries.start());
            }
            return ""; // A broken/changed page is not silently labelled complete.
        }
        return "";
    }

    static List<Block> blocks(String bodyHtml) {
        if (bodyHtml.isBlank()) return List.of();
        var reader = new Reader();
        try {
            new ParserDelegator().parse(new StringReader(NON_CONTENT.matcher(bodyHtml).replaceAll("")
                    .replace("&apos;", "&#39;")), reader, true);
            reader.flush();
            return List.copyOf(reader.blocks);
        } catch (IOException error) {
            return List.of();
        }
    }

    static List<Link> links(String bodyHtml, String sourceUrl) {
        Map<String, Link> links = new LinkedHashMap<>();
        var anchors = Pattern.compile("(?is)<a\\b[^>]*\\bhref\\s*=\\s*(['\"])(.*?)\\1[^>]*>(.*?)</a>")
                .matcher(NON_CONTENT.matcher(bodyHtml).replaceAll(""));
        while (anchors.find()) {
            String url = safeUrl(anchors.group(2).replace("&amp;", "&"), sourceUrl, false);
            if (url == null || isImageUrl(url)) continue;
            // The app has no CMS carousel/anchor targets to navigate to.
            if (url.contains("#") && url.split("#", 2)[0].equals(sourceUrl.split("#", 2)[0])) continue;
            var text = blocks(anchors.group(3));
            String title = text.stream().map(Block::text).collect(java.util.stream.Collectors.joining(" "));
            // CMS galleries wrap each thumbnail in a link to the original photo.
            // Keep actual documents (including image-only PDF download buttons).
            if (title.isBlank() && IMAGE.matcher(anchors.group(3)).find() && !isDocumentUrl(url)) continue;
            links.putIfAbsent(url, new Link(title.isBlank() ? "Відкрити посилання" : title, url));
        }
        return List.copyOf(links.values());
    }

    private static boolean isImageUrl(String url) {
        return URI.create(url).getPath().toLowerCase(java.util.Locale.ROOT)
                .matches(".*\\.(?:jpe?g|png|webp|gif|avif|bmp|tiff?|svg)$");
    }

    private static boolean isDocumentUrl(String url) {
        return URI.create(url).getPath().toLowerCase(java.util.Locale.ROOT)
                .matches(".*\\.(?:pdf|docx?|xlsx?|pptx?|odt|ods|rtf|txt|csv|zip)$");
    }

    static String image(String articleHtml, String sourceUrl) {
        var images = IMAGE.matcher(articleHtml);
        while (images.find()) {
            String url = safeUrl(images.group(2), sourceUrl, true);
            if (url != null) return url;
        }
        return null;
    }

    private static String safeUrl(String value, String sourceUrl, boolean sameHost) {
        try {
            URI source = URI.create(sourceUrl);
            URI url = source.resolve(value.trim());
            if (url.getHost() == null || url.getUserInfo() != null
                    || !("https".equalsIgnoreCase(url.getScheme()) || "http".equalsIgnoreCase(url.getScheme()))
                    || (sameHost && (!"https".equalsIgnoreCase(url.getScheme())
                    || !source.getHost().equalsIgnoreCase(url.getHost())))) return null;
            return url.toString();
        } catch (IllegalArgumentException error) { return null; }
    }

    private static final class Reader extends HTMLEditorKit.ParserCallback {
        private final List<Block> blocks = new ArrayList<>();
        private final StringBuilder text = new StringBuilder();
        private final Deque<Integer> lists = new ArrayDeque<>();
        private String type = "paragraph";

        @Override public void handleText(char[] data, int position) { text.append(data); }
        @Override public void handleSimpleTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
            if (tag == HTML.Tag.BR) text.append('\n');
        }
        @Override public void handleStartTag(HTML.Tag tag, MutableAttributeSet attributes, int position) {
            String name = tag.toString();
            if (tag == HTML.Tag.UL || tag == HTML.Tag.OL) { flush(); lists.push(tag == HTML.Tag.OL ? 0 : -1); }
            else if (tag == HTML.Tag.LI) {
                flush(); type = "listItem";
                if (!lists.isEmpty() && lists.peek() >= 0) {
                    int number = lists.pop() + 1; lists.push(number); text.append(number).append(". ");
                } else text.append("• ");
            } else if (name.matches("h[2-6]")) { flush(); type = "heading"; }
            else if (tag == HTML.Tag.P || tag == HTML.Tag.DIV || tag == HTML.Tag.TR || tag == HTML.Tag.BLOCKQUOTE) {
                // <li><p>…</p></li> must keep its list marker with the text.
                if (!text.toString().matches("(?:• |\\d+\\. )")) flush();
            } else if (tag == HTML.Tag.TD || tag == HTML.Tag.TH) { if (!text.isEmpty()) text.append(" · "); }
        }
        @Override public void handleEndTag(HTML.Tag tag, int position) {
            if (tag == HTML.Tag.UL || tag == HTML.Tag.OL) { flush(); if (!lists.isEmpty()) lists.pop(); }
            else if (tag == HTML.Tag.P || tag == HTML.Tag.DIV || tag == HTML.Tag.LI || tag == HTML.Tag.TR
                    || tag == HTML.Tag.BLOCKQUOTE || tag.toString().matches("h[2-6]")) flush();
        }
        @Override public void flush() {
            String value = text.toString().replace('\u00a0', ' ').replaceAll("[\\t\\x0B\\f\\r ]+", " ").trim();
            if (!value.isBlank() && !value.matches("(?:•|\\d+\\.)")) blocks.add(new Block(type, value));
            text.setLength(0); type = "paragraph";
        }
    }
}
