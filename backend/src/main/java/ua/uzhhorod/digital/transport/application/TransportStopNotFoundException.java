package ua.uzhhorod.digital.transport.application;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class TransportStopNotFoundException extends RuntimeException {

    public TransportStopNotFoundException(UUID stopId) {
        super("Transport stop not found: " + stopId);
    }
}
