CREATE TABLE transport_route_shape_points (
    route_variant_id UUID NOT NULL REFERENCES transport_route_variants(id) ON DELETE CASCADE,
    point_sequence INTEGER NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (route_variant_id, point_sequence)
);
