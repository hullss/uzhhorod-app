package ua.uzhhorod.digital.cityservices.news.application;

import java.lang.reflect.InvocationTargetException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/** Offline fallback: executes these pure parser tests, not the Spring integration suite. */
public final class NewsParserCheck {
    public static void main(String[] args) throws Exception {
        int count = 0;
        var instance = new OfficialNewsParserTest();
        for (var method : OfficialNewsParserTest.class.getDeclaredMethods()) {
            if (!method.isAnnotationPresent(Test.class)) continue;
            try { method.invoke(instance); }
            catch (InvocationTargetException error) { throw new AssertionError(method.getName(), error.getCause()); }
            System.out.println("PASS: " + method.getName()); count++;
        }
        if (count == 0) throw new AssertionError("No tests executed");
        System.out.println("Parser checks passed: " + count + " (not a full Maven/Spring build)");
        if (args.length == 2) {
            var article = OfficialNewsParser.parseArticle(Files.readString(Path.of(args[0])),
                    "https://rada-uzhgorod.gov.ua/post/v-uzhhorodi-16", null);
            String blocks = article.blocks().stream().map(block -> "{\"type\":" + quote(block.type()) + ",\"text\":" + quote(block.text()) + "}")
                    .collect(java.util.stream.Collectors.joining(","));
            String links = article.links().stream().map(link -> "{\"title\":" + quote(link.title()) + ",\"url\":" + quote(link.url()) + "}")
                    .collect(java.util.stream.Collectors.joining(","));
            Files.writeString(Path.of(args[1]), "{\"title\":" + quote(article.title()) + ",\"sourceUrl\":" + quote(article.sourceUrl())
                    + ",\"publishedLabel\":" + quote(article.publishedLabel()) + ",\"preview\":" + quote(article.preview())
                    + ",\"blocks\":[" + blocks + "],\"links\":[" + links + "],\"imageUrl\":" + quote(article.imageUrl())
                    + ",\"fullTextAvailable\":" + article.fullTextAvailable() + "}");
        }
    }
    private static String quote(String value) {
        if (value == null) return "null";
        StringBuilder json = new StringBuilder("\"");
        for (char character : value.toCharArray()) {
            if (character == '\\' || character == '"') json.append('\\').append(character);
            else if (character < 32) json.append(String.format("\\u%04x", (int) character));
            else json.append(character);
        }
        return json.append('"').toString();
    }
}
