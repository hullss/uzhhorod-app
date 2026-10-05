create table user_accounts (
    id uuid primary key,
    email varchar(254) not null unique,
    password_hash varchar(128) not null,
    password_salt varchar(64) not null,
    session_token varchar(64),
    session_expires_at timestamp with time zone,
    language varchar(8) not null default 'uk',
    notifications_alert boolean not null default true,
    notifications_news boolean not null default true,
    notifications_transport boolean not null default false,
    notifications_silence boolean not null default false,
    created_at timestamp with time zone not null
);

create index user_accounts_session_token_idx on user_accounts(session_token);
