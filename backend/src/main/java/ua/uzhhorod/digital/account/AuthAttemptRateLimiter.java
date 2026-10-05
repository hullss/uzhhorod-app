package ua.uzhhorod.digital.account;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** A small per-identity guard. Deployments with several instances should replace it with Redis. */
@Component
class AuthAttemptRateLimiter {
    private static final int MAX_ATTEMPTS = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private final Map<String, AttemptWindow> attempts = new ConcurrentHashMap<>();

    void check(String action, String email) {
        String key = action + ":" + email;
        Instant now = Instant.now();
        AttemptWindow window = attempts.compute(key, (ignored, current) -> {
            if (current == null || current.startedAt().plus(WINDOW).isBefore(now)) return new AttemptWindow(now, 1);
            return new AttemptWindow(current.startedAt(), current.count() + 1);
        });
        if (window.count() > MAX_ATTEMPTS) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Try again later.");
        }
    }

    void clear(String action, String email) { attempts.remove(action + ":" + email); }

    private record AttemptWindow(Instant startedAt, int count) { }
}
