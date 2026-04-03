-- Nonces table (temporary, for wallet auth challenge)
create table if not exists auth_nonces (
  address text primary key,
  nonce text not null,
  message text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Users table
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  address text unique not null,
  chain text not null default 'solana',
  plan text not null default 'free',
  limit_per_month int not null default 100,
  used_this_month int not null default 0,
  last_login timestamptz,
  created_at timestamptz default now()
);

-- API keys table
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  address text not null,
  key text unique not null,
  created_at timestamptz default now()
);

-- Auto-clean expired nonces
create or replace function delete_expired_nonces() returns trigger as $$
begin
  delete from auth_nonces where expires_at < now();
  return new;
end;
$$ language plpgsql;

create or replace trigger cleanup_nonces
  after insert on auth_nonces
  execute function delete_expired_nonces();
