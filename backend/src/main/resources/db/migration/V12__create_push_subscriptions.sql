create table push_subscriptions (
    expo_push_token varchar(255) primary key,
    alert_enabled boolean not null default true,
    news_enabled boolean not null default true,
    transport_enabled boolean not null default false,
    updated_at timestamp with time zone not null
);
