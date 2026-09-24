CREATE TABLE transport_stops (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE transport_route_stops (
    route_id UUID NOT NULL REFERENCES transport_routes(id),
    stop_id UUID NOT NULL REFERENCES transport_stops(id),
    PRIMARY KEY (route_id, stop_id)
);
