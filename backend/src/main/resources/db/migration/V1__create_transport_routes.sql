CREATE TABLE transport_routes (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    route_number VARCHAR(30) NOT NULL,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
