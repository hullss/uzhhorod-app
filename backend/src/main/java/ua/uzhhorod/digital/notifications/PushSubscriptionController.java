package ua.uzhhorod.digital.notifications;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notifications/subscriptions")
public class PushSubscriptionController {
    private final PushSubscriptionRepository subscriptions;
    public PushSubscriptionController(PushSubscriptionRepository subscriptions) { this.subscriptions = subscriptions; }

    @PostMapping
    public void subscribe(@Valid @RequestBody SubscriptionRequest body) {
        requireExpoToken(body.expoPushToken());
        PushSubscription subscription = subscriptions.findById(body.expoPushToken())
                .orElseGet(() -> new PushSubscription(body.expoPushToken(), body.alert(), body.news(), body.transport()));
        subscription.update(body.alert(), body.news(), body.transport());
        subscriptions.save(subscription);
    }

    @DeleteMapping
    public void unsubscribe(@Valid @RequestBody TokenRequest body) { subscriptions.deleteById(body.expoPushToken()); }

    private static void requireExpoToken(String token) {
        if (!token.startsWith("ExponentPushToken[") && !token.startsWith("ExpoPushToken[")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only Expo push tokens are accepted");
        }
    }

    public record SubscriptionRequest(@NotBlank @Size(max = 255) String expoPushToken, boolean alert, boolean news, boolean transport) { }
    public record TokenRequest(@NotBlank @Size(max = 255) String expoPushToken) { }
}
