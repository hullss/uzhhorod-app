package ua.uzhhorod.digital.account;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/account")
public class AccountController {
    private static final SecureRandom RANDOM = new SecureRandom();
    private final AccountUserRepository users;
    private final AuthAttemptRateLimiter rateLimiter;
    public AccountController(AccountUserRepository users, AuthAttemptRateLimiter rateLimiter) { this.users = users; this.rateLimiter = rateLimiter; }

    @PostMapping("/register")
    public SessionResponse register(@Valid @RequestBody Credentials body) {
        String email = normalizeEmail(body.email());
        rateLimiter.check("register", email);
        if (users.findByEmail(email).isPresent()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Email is already registered");
        byte[] salt = new byte[16]; RANDOM.nextBytes(salt);
        AccountUser user = new AccountUser(email, passwordHash(body.password(), salt), Base64.getEncoder().encodeToString(salt));
        rateLimiter.clear("register", email);
        return sessionFor(users.save(user));
    }

    @PostMapping("/login")
    public SessionResponse login(@Valid @RequestBody Credentials body) {
        String email = normalizeEmail(body.email());
        rateLimiter.check("login", email);
        AccountUser user = users.findByEmail(email).orElseThrow(() -> unauthorized());
        byte[] salt = Base64.getDecoder().decode(user.getPasswordSalt());
        if (!MessageDigest.isEqual(user.getPasswordHash().getBytes(StandardCharsets.UTF_8), passwordHash(body.password(), salt).getBytes(StandardCharsets.UTF_8))) throw unauthorized();
        rateLimiter.clear("login", email);
        return sessionFor(users.save(user));
    }

    @GetMapping("/preferences") public PreferencesResponse preferences(@RequestHeader("Authorization") String authorization) { return response(authenticated(authorization)); }
    @PutMapping("/preferences") public PreferencesResponse updatePreferences(@RequestHeader("Authorization") String authorization, @Valid @RequestBody PreferencesRequest body) {
        AccountUser user = authenticated(authorization);
        user.updatePreferences(body.language(), body.alert(), body.news(), body.transport(), body.silence());
        return response(users.save(user));
    }
    @GetMapping("/favorites") public FavoritesResponse favorites(@RequestHeader("Authorization") String authorization) { return favoritesResponse(authenticated(authorization)); }
    @PutMapping("/favorites") public FavoritesResponse updateFavorites(@RequestHeader("Authorization") String authorization, @Valid @RequestBody FavoritesRequest body) {
        AccountUser user = authenticated(authorization);
        user.updateFavorites(body.routeIds(), body.stopIds());
        return favoritesResponse(users.save(user));
    }
    @PutMapping("/password") public SessionResponse changePassword(@RequestHeader("Authorization") String authorization, @Valid @RequestBody ChangePasswordRequest body) {
        AccountUser user = authenticated(authorization);
        byte[] oldSalt = Base64.getDecoder().decode(user.getPasswordSalt());
        if (!MessageDigest.isEqual(user.getPasswordHash().getBytes(StandardCharsets.UTF_8), passwordHash(body.currentPassword(), oldSalt).getBytes(StandardCharsets.UTF_8))) throw unauthorized();
        byte[] newSalt = new byte[16]; RANDOM.nextBytes(newSalt);
        user.changePassword(passwordHash(body.newPassword(), newSalt), Base64.getEncoder().encodeToString(newSalt));
        return sessionFor(users.save(user));
    }
    @DeleteMapping("/session") public void logout(@RequestHeader("Authorization") String authorization) { AccountUser user = authenticated(authorization); user.clearSession(); users.save(user); }
    @DeleteMapping public void deleteAccount(@RequestHeader("Authorization") String authorization) { users.delete(authenticated(authorization)); }
    private SessionResponse sessionFor(AccountUser user) {
        byte[] token = new byte[32]; RANDOM.nextBytes(token);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(token);
        user.startSession(tokenHash(rawToken), Instant.now().plus(30, ChronoUnit.DAYS));
        AccountUser saved = users.save(user);
        return new SessionResponse(rawToken, response(saved), favoritesResponse(saved));
    }
    private AccountUser authenticated(String authorization) {
        String token = authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : "";
        AccountUser user = users.findBySessionTokenHash(tokenHash(token)).orElseThrow(() -> unauthorized());
        if (user.getSessionExpiresAt() == null || user.getSessionExpiresAt().isBefore(Instant.now())) {
            user.clearSession(); users.save(user); throw unauthorized();
        }
        return user;
    }
    private static ResponseStatusException unauthorized() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"); }
    private static String normalizeEmail(String email) { return email.trim().toLowerCase(java.util.Locale.ROOT); }
    private static String passwordHash(String password, byte[] salt) { try { PBEKeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 210_000, 256); return Base64.getEncoder().encodeToString(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded()); } catch (Exception error) { throw new IllegalStateException("Password hashing unavailable", error); } }
    private static String tokenHash(String token) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); } catch (Exception error) { throw new IllegalStateException("Token hashing unavailable", error); } }
    public record Credentials(@Email @NotBlank String email, @NotBlank @Size(min = 10, max = 128) String password) { }
    public record ChangePasswordRequest(@NotBlank @Size(min = 10, max = 128) String currentPassword, @NotBlank @Size(min = 10, max = 128) String newPassword) { }
    public record PreferencesRequest(@NotBlank @Size(max = 8) String language, boolean alert, boolean news, boolean transport, boolean silence) { }
    public record FavoritesRequest(@NotNull @Size(max = 32) List<@NotBlank @Size(max = 128) String> routeIds, @NotNull @Size(max = 32) List<@NotBlank @Size(max = 128) String> stopIds) { }
    public record FavoritesResponse(List<String> routeIds, List<String> stopIds) { }
    public record PreferencesResponse(String email, String language, boolean alert, boolean news, boolean transport, boolean silence) { }
    public record SessionResponse(String accessToken, PreferencesResponse preferences, FavoritesResponse favorites) { }
    private static PreferencesResponse response(AccountUser user) { return new PreferencesResponse(user.getEmail(), user.getLanguage(), user.isNotificationsAlert(), user.isNotificationsNews(), user.isNotificationsTransport(), user.isNotificationsSilence()); }
    private static FavoritesResponse favoritesResponse(AccountUser user) { return new FavoritesResponse(user.getFavoriteRouteIds(), user.getFavoriteStopIds()); }
}
