-- 0045_market_asset_categories_v1.sql
-- Additive market taxonomy foundation for spot and perpetual market pickers.
-- Categories are metadata only: no balances, orders, positions, or trade rows are changed.
-- Assets may belong to multiple categories. Contract/network identity is optional so
-- ERC-404 and inscription assets can be distinguished when trusted metadata is available.
-- No asset is auto-classified by this migration; assignments are intentionally empty.

create table if not exists public.btcbox_market_categories (
  category_key text primary key
    check (category_key ~ '^[a-z][a-z0-9_]{1,31}$'),
  name_zh text not null check (length(btrim(name_zh)) between 1 and 40),
  name_en text not null check (length(btrim(name_en)) between 1 and 40),
  description_zh text not null default '',
  description_en text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 100 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.btcbox_asset_category_assignments (
  id bigint generated always as identity primary key,
  asset_code text not null check (asset_code ~ '^[A-Z0-9]{2,16}$'),
  category_key text not null references public.btcbox_market_categories(category_key) on update cascade on delete restrict,
  network text,
  contract_address text,
  source text not null default 'admin'
    check (source in ('admin','provider','verified_import')),
  source_reference text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (network is null or (length(btrim(network)) between 1 and 64)),
  check (contract_address is null or (length(btrim(contract_address)) between 1 and 160)),
  check (contract_address is null or network is not null)
);

-- One category may be assigned to an asset globally, or to a specific network contract.
create unique index if not exists btcbox_asset_category_identity_uidx
  on public.btcbox_asset_category_assignments (
    asset_code,
    category_key,
    coalesce(lower(network), ''),
    coalesce(lower(contract_address), '')
  );

create index if not exists btcbox_asset_category_lookup_idx
  on public.btcbox_asset_category_assignments(asset_code, active, category_key);

-- Seed taxonomy only. Do not infer or insert assignments from ticker names.
insert into public.btcbox_market_categories
  (category_key, name_zh, name_en, description_zh, description_en, enabled, sort_order)
values
  ('meme', 'Meme', 'Meme', '社区文化与迷因类资产；需经人工或可信数据源确认。', 'Community and meme-driven assets; requires manual or trusted-source classification.', true, 10),
  ('ai', 'AI', 'AI', '人工智能相关资产；需经人工或可信数据源确认。', 'Artificial-intelligence related assets; requires manual or trusted-source classification.', true, 20),
  ('erc404', 'ERC-404', 'ERC-404', 'ERC-404 标准或兼容资产；需核验链与合约地址。', 'ERC-404 standard or compatible assets; verify chain and contract address.', true, 30),
  ('inscription', '铭文', 'Inscription', '铭文及相关协议资产；需核验协议与数据来源。', 'Inscription and related protocol assets; verify protocol and data source.', true, 40)
on conflict (category_key) do nothing;

alter table public.btcbox_market_categories enable row level security;
alter table public.btcbox_asset_category_assignments enable row level security;

revoke all on public.btcbox_market_categories, public.btcbox_asset_category_assignments
  from public, anon, authenticated;
grant select on public.btcbox_market_categories, public.btcbox_asset_category_assignments to service_role;
grant insert, update, delete on public.btcbox_asset_category_assignments to service_role;

do $$
declare
  v_sequence text := pg_get_serial_sequence('public.btcbox_asset_category_assignments','id');
begin
  if v_sequence is not null then
    execute format('grant usage, select on sequence %s to service_role', v_sequence);
  end if;
end;
$$;

-- Verify seeded taxonomy keys without requiring or mutating the asset catalogue.
do $$
begin
  if (select count(*) from public.btcbox_market_categories
      where category_key in ('meme','ai','erc404','inscription')) <> 4 then
    raise exception 'market category seed verification failed';
  end if;
end;
$$;
