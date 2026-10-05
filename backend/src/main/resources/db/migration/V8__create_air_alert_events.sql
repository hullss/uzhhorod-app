create table air_alert_events (
    id uuid primary key,
    state varchar(16) not null,
    title varchar(255) not null,
    detail varchar(500) not null,
    occurred_at timestamp with time zone not null
);

create index air_alert_events_occurred_at_idx on air_alert_events(occurred_at desc);
