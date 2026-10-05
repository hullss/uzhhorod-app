package ua.uzhhorod.digital.account;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "user_accounts")
public class AccountUser {
    @Id private UUID id;
    @Column(nullable = false, unique = true) private String email;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "password_salt", nullable = false) private String passwordSalt;
    @Column(name = "session_token_hash") private String sessionTokenHash;
    @Column(name = "session_expires_at") private Instant sessionExpiresAt;
    @Column(nullable = false) private String language;
    @Column(name = "notifications_alert", nullable = false) private boolean notificationsAlert;
    @Column(name = "notifications_news", nullable = false) private boolean notificationsNews;
    @Column(name = "notifications_transport", nullable = false) private boolean notificationsTransport;
    @Column(name = "notifications_silence", nullable = false) private boolean notificationsSilence;
    @Column(name = "favorite_route_ids", nullable = false) private String favoriteRouteIds;
    @Column(name = "favorite_stop_ids", nullable = false) private String favoriteStopIds;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    protected AccountUser() { }
    AccountUser(String email, String passwordHash, String passwordSalt) {
        this.id = UUID.randomUUID(); this.email = email; this.passwordHash = passwordHash; this.passwordSalt = passwordSalt;
        this.language = "uk"; this.notificationsAlert = true; this.notificationsNews = true; this.createdAt = Instant.now();
        this.favoriteRouteIds = ""; this.favoriteStopIds = "";
    }
    UUID getId() { return id; } String getEmail() { return email; } String getPasswordHash() { return passwordHash; } String getPasswordSalt() { return passwordSalt; }
    String getSessionTokenHash() { return sessionTokenHash; } Instant getSessionExpiresAt() { return sessionExpiresAt; }
    String getLanguage() { return language; } boolean isNotificationsAlert() { return notificationsAlert; } boolean isNotificationsNews() { return notificationsNews; } boolean isNotificationsTransport() { return notificationsTransport; } boolean isNotificationsSilence() { return notificationsSilence; }
    List<String> getFavoriteRouteIds() { return favoritesFrom(favoriteRouteIds); }
    List<String> getFavoriteStopIds() { return favoritesFrom(favoriteStopIds); }
    void startSession(String tokenHash, Instant expiresAt) { sessionTokenHash = tokenHash; sessionExpiresAt = expiresAt; }
    void clearSession() { sessionTokenHash = null; sessionExpiresAt = null; }
    void changePassword(String passwordHash, String passwordSalt) { this.passwordHash = passwordHash; this.passwordSalt = passwordSalt; }
    void updatePreferences(String language, boolean alert, boolean news, boolean transport, boolean silence) { this.language = language; notificationsAlert = alert; notificationsNews = news; notificationsTransport = transport; notificationsSilence = silence; }
    void updateFavorites(List<String> routeIds, List<String> stopIds) { favoriteRouteIds = favoritesTo(routeIds); favoriteStopIds = favoritesTo(stopIds); }
    private static List<String> favoritesFrom(String value) { return value == null || value.isBlank() ? List.of() : Arrays.stream(value.split(",")).filter(item -> !item.isBlank()).toList(); }
    private static String favoritesTo(List<String> values) { return values.stream().filter(item -> item != null && !item.isBlank()).map(String::trim).distinct().limit(32).reduce((left, right) -> left + "," + right).orElse(""); }
}
