package ua.uzhhorod.digital.transport.domain;

import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface TransportRouteVariantStopRepository
        extends JpaRepository<TransportRouteVariantStop, TransportRouteVariantStopId> {

    List<TransportRouteVariantStop> findAllByIdRouteVariantIdOrderByIdStopSequenceAsc(UUID routeVariantId);

    @Modifying
    @Transactional
    @Query("delete from TransportRouteVariantStop routeVariantStop where routeVariantStop.id.routeVariantId = :routeVariantId")
    void deleteByRouteVariantId(UUID routeVariantId);
}
