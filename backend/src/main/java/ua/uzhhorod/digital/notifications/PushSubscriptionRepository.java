package ua.uzhhorod.digital.notifications;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

interface PushSubscriptionRepository extends JpaRepository<PushSubscription, String> {
    List<PushSubscription> findByAlertEnabledTrue();
}
