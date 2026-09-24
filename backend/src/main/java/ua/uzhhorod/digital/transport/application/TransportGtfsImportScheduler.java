package ua.uzhhorod.digital.transport.application;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class TransportGtfsImportScheduler {

    private static final Logger LOGGER = LoggerFactory.getLogger(TransportGtfsImportScheduler.class);
    private final GtfsRouteImportService importService;

    public TransportGtfsImportScheduler(GtfsRouteImportService importService) {
        this.importService = importService;
    }

    @Scheduled(cron = "${transport.gtfs-import-cron:0 0 3 * * *}", zone = "${transport.gtfs-import-zone:Europe/Kyiv}")
    public void importGtfs() {
        try {
            importService.importTransportData();
        } catch (RuntimeException exception) {
            LOGGER.error("Scheduled GTFS import failed", exception);
        }
    }
}
