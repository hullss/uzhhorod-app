package ua.uzhhorod.digital.cityservices.miniatures.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import ua.uzhhorod.digital.cityservices.miniatures.api.MiniSculptureListResponse;
import ua.uzhhorod.digital.cityservices.miniatures.api.MiniSculptureResponse;

/** Read-only editorial facts and original summaries; no third-party descriptions or photos. */
@Service
public class MiniSculptureCatalogService {
    private final MiniSculptureListResponse catalog;

    public MiniSculptureCatalogService(ObjectMapper mapper) {
        try (var stream = new ClassPathResource("mini-sculptures.json").getInputStream()) {
            var loaded = mapper.readValue(stream, MiniSculptureListResponse.class);
            validate(loaded);
            catalog = new MiniSculptureListResponse(loaded.sourceCheckedAt(), loaded.verificationNotice(),
                    loaded.sculptures().stream().map(point -> new MiniSculptureResponse(
                            point.id(), point.title(), point.latitude(), point.longitude(), point.address(),
                            point.author(), point.installedAt(), point.installedYear(), point.summary(),
                            List.copyOf(point.sourceUrls()))).toList());
        } catch (IOException error) {
            throw new IllegalStateException("Miniature catalog cannot be loaded", error);
        }
    }

    public MiniSculptureListResponse getCatalog() { return catalog; }

    private static void validate(MiniSculptureListResponse value) {
        if (value.sourceCheckedAt() == null || value.verificationNotice() == null
                || value.verificationNotice().isBlank() || value.sculptures() == null
                || value.sculptures().isEmpty() || value.sculptures().size() > 500) {
            throw new IllegalStateException("Miniature catalog metadata is invalid");
        }
        var ids = new HashSet<String>();
        for (var point : value.sculptures()) {
            if (point == null || blank(point.id()) || !ids.add(point.id()) || blank(point.title())
                    || blank(point.address()) || blank(point.author()) || blank(point.summary())
                    || !Double.isFinite(point.latitude()) || !Double.isFinite(point.longitude())
                    || point.latitude() < 48.56 || point.latitude() > 48.70
                    || point.longitude() < 22.16 || point.longitude() > 22.42
                    || point.installedYear() == null || point.installedYear() < 2010
                    || point.installedYear() > LocalDate.now().getYear()
                    || (point.installedAt() != null && point.installedAt().getYear() != point.installedYear())
                    || point.sourceUrls() == null || point.sourceUrls().isEmpty()
                    || point.sourceUrls().stream().anyMatch(url -> blank(url) || !url.startsWith("https://"))) {
                throw new IllegalStateException("Miniature catalog point is invalid: " + (point == null ? "null" : point.id()));
            }
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }
}
