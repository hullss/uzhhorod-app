CREATE TABLE transport_route_variants (
    id UUID PRIMARY KEY,
    external_id VARCHAR(255) NOT NULL UNIQUE,
    route_id UUID NOT NULL REFERENCES transport_routes(id),
    direction_id INTEGER,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE transport_route_variant_stops (
    route_variant_id UUID NOT NULL REFERENCES transport_route_variants(id),
    stop_id UUID NOT NULL REFERENCES transport_stops(id),
    stop_sequence INTEGER NOT NULL,
    PRIMARY KEY (route_variant_id, stop_sequence)
);
