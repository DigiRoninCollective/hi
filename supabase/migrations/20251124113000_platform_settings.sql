create table if not exists public.platform_settings (
  id text primary key default 'default',
  buy_fee_bps integer not null default 150,
  sell_fee_bps integer not null default 150,
  fee_wallet text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);

comment on column public.platform_settings.buy_fee_bps is 'Fee in basis points applied on buys';
comment on column public.platform_settings.sell_fee_bps is 'Fee in basis points applied on sells';
comment on column public.platform_settings.fee_wallet is 'Destination wallet for platform fees';
