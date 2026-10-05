alter table user_accounts
    add column favorite_route_ids text not null default '',
    add column favorite_stop_ids text not null default '';
