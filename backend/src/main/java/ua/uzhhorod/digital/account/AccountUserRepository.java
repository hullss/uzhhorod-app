package ua.uzhhorod.digital.account;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
interface AccountUserRepository extends JpaRepository<AccountUser, UUID> {
    Optional<AccountUser> findByEmail(String email);
    Optional<AccountUser> findBySessionTokenHash(String sessionTokenHash);
}
