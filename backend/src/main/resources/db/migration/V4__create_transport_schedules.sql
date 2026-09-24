CREATE TABLE transport_service_calendars (
    service_id VARCHAR(255) PRIMARY KEY,
    monday BOOLEAN NOT NULL,
    tuesday BOOLEAN NOT NULL,
    wednesday BOOLEAN NOT NULL,
    thursday BOOLEAN NOT NULL,
    friday BOOLEAN NOT NULL,
    saturday BOOLEAN NOT NULL,
    sunday BOOLEAN NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

CREATE TABLE transport_service_calendar_dates (
    service_id VARCHAR(255) NOT NULL,
    service_date DATE NOT NULL,
    exception_type INTEGER NOT NULL,
    PRIMARY KEY (service_id, service_date)
);

CREATE TABLE transport_trips (
    id UUID PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL UNIQUE,
    route_variant_id UUID NOT NULL REFERENCES transport_route_variants(id),
    service_id VARCHAR(255) NOT NULL
);

CREATE TABLE transport_trip_stop_times (
    trip_id UUID NOT NULL REFERENCES transport_trips(id) ON DELETE CASCADE,
    stop_sequence INTEGER NOT NULL,
    stop_id UUID NOT NULL REFERENCES transport_stops(id),
    arrival_time_seconds INTEGER,
    departure_time_seconds INTEGER,
    PRIMARY KEY (trip_id, stop_sequence)
);

CREATE INDEX idx_transport_trip_stop_times_stop_id
    ON transport_trip_stop_times(stop_id);
