create table if not exists public.wallet_pools (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  public_key text not null,
  encrypted_private_key text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_pools_user on public.wallet_pools(user_id);

create table if not exists public.user_launch_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  enable_multi_wallet boolean not null default false,
  wallets_to_use integer not null default 3,
  max_per_wallet_sol numeric not null default 1,
  amount_variance_bps integer not null default 250, -- +/-2.5%
  timing_jitter_ms integer not null default 8000,
  auto_sell boolean not null default false,
  auto_top_up boolean not null default false,
  min_balance_sol numeric not null default 0.2,
  top_up_amount_sol numeric not null default 0.5,
  initial_buy_sol numeric not null default 0.1,
  slippage numeric not null default 10,
  priority_fee numeric not null default 0.0005,
  auto_deploy boolean not null default false,
  mayhem_mode boolean not null default false,
  updated_at timestamptz not null default now()
);
