package ua.uzhhorod.digital.cityservices.miniatures.api;

import java.time.Instant;
import java.util.List;

public record MiniSculptureListResponse(
        Instant sourceCheckedAt,
        String verificationNotice,
        List<MiniSculptureResponse> sculptures) {
}
