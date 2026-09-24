CREATE TABLE transport_import_runs (
    id UUID PRIMARY KEY,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(30) NOT NULL,
    source_url VARCHAR(1000) NOT NULL,
    imported_route_count INTEGER,
    imported_stop_count INTEGER,
    imported_route_stop_count INTEGER,
    imported_route_variant_count INTEGER,
    error_message VARCHAR(1000)
);

CREATE INDEX idx_transport_import_runs_status_finished_at
    ON transport_import_runs(status, finished_at DESC);
