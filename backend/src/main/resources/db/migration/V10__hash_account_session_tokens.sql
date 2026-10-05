-- Existing sessions are intentionally invalidated: an old raw token must never be copied into the new column.
drop index if exists user_accounts_session_token_idx;
alter table user_accounts drop column session_token;
alter table user_accounts add column session_token_hash varchar(64);
create index user_accounts_session_token_hash_idx on user_accounts(session_token_hash);
