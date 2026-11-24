-- 0049_btcbox_complete_26_asset_registry_v1.sql
-- Add the 17 missing active assets to the populated BTCBOX registry.
-- The existing btcbox_asset_seed_wallet_accounts_v1 trigger creates one
-- zero-balance wallet row per existing profile for each newly inserted asset.
-- This intentionally adds asset wallets only; it never updates existing balances,
-- profiles, financial_accounts, financial_operations or financial_ledger.
-- NEAR is capped at 18 internal decimals because the current BTCBOX registry
-- and financial numeric(38,18) model support at most 18 decimal places.

begin;

do $preflight$
begin
  if to_regclass('public.btcbox_assets') is null then
    raise exception 'BTCBOX asset registry is required';
  end if;

  -- The populated production schema has both wallet tables and the legacy
  -- asset-seeding trigger. A fresh bootstrap has neither wallet table; it still
  -- receives the canonical asset registry without creating wallet structures.
  if (to_regclass('public.btcbox_wallet_accounts') is null)
     is distinct from (to_regclass('public.btcbox_user_profiles') is null) then
    raise exception 'wallet accounts and user profiles must either both exist or both be absent';
  end if;

  if exists (
    select 1
      from public.btcbox_assets
     where asset_code in (
       'USDC','LINK','DOT','TRX','LTC','BCH','NEAR','UNI','ATOM',
       'ETC','APT','ARB','OP','SUI','INJ','TIA','FIL'
     )
       and (
         active is distinct from true
         or (asset_code, decimals, asset_type) not in (
           ('USDC',6,'stablecoin'),('LINK',18,'crypto'),('DOT',10,'crypto'),
           ('TRX',6,'crypto'),('LTC',8,'crypto'),('BCH',8,'crypto'),
           ('NEAR',18,'crypto'),('UNI',18,'crypto'),('ATOM',6,'crypto'),
           ('ETC',18,'crypto'),('APT',8,'crypto'),('ARB',18,'crypto'),
           ('OP',18,'crypto'),('SUI',9,'crypto'),('INJ',18,'crypto'),
           ('TIA',6,'crypto'),('FIL',18,'crypto')
         )
       )
  ) then
    raise exception 'target asset exists with an unexpected active state or precision; reconcile before seeding';
  end if;

  if to_regclass('public.btcbox_wallet_accounts') is not null then
    if exists (
      select 1 from public.btcbox_wallet_accounts
       where asset_code in (
         'USDC','LINK','DOT','TRX','LTC','BCH','NEAR','UNI','ATOM',
         'ETC','APT','ARB','OP','SUI','INJ','TIA','FIL'
       )
    ) then
      raise exception 'wallet rows already exist for a target asset; reconcile before seeding';
    end if;
  end if;
end
$preflight$;

insert into public.btcbox_assets(asset_code,asset_name,asset_type,decimals,active)
values
 ('USDC','USD Coin','stablecoin',6,true),
 ('LINK','Chainlink','crypto',18,true),
 ('DOT','Polkadot','crypto',10,true),
 ('TRX','TRON','crypto',6,true),
 ('LTC','Litecoin','crypto',8,true),
 ('BCH','Bitcoin Cash','crypto',8,true),
 ('NEAR','NEAR Protocol','crypto',18,true),
 ('UNI','Uniswap','crypto',18,true),
 ('ATOM','Cosmos','crypto',6,true),
 ('ETC','Ethereum Classic','crypto',18,true),
 ('APT','Aptos','crypto',8,true),
 ('ARB','Arbitrum','crypto',18,true),
 ('OP','Optimism','crypto',18,true),
 ('SUI','Sui','crypto',9,true),
 ('INJ','Injective','crypto',18,true),
 ('TIA','Celestia','crypto',6,true),
 ('FIL','Filecoin','crypto',18,true)
on conflict (asset_code) do nothing;

do $verify$
declare
  v_profiles bigint;
  v_assets bigint;
  v_wallet_rows bigint;
  v_nonzero_wallets bigint;
begin
  select count(*) into v_assets
    from public.btcbox_assets
   where active is true
     and asset_code in (
       'USDC','LINK','DOT','TRX','LTC','BCH','NEAR','UNI','ATOM',
       'ETC','APT','ARB','OP','SUI','INJ','TIA','FIL'
     );
  if v_assets <> 17 then
    raise exception 'asset registry verification failed: expected 17 new active assets, found %', v_assets;
  end if;

  if to_regclass('public.btcbox_wallet_accounts') is not null then
    select count(*) into v_profiles from public.btcbox_user_profiles;
    select count(*), count(*) filter (where available <> 0 or frozen <> 0)
      into v_wallet_rows, v_nonzero_wallets
      from public.btcbox_wallet_accounts
     where asset_code in (
       'USDC','LINK','DOT','TRX','LTC','BCH','NEAR','UNI','ATOM',
       'ETC','APT','ARB','OP','SUI','INJ','TIA','FIL'
     );

    if v_wallet_rows <> v_profiles * 17 or v_nonzero_wallets <> 0 then
      raise exception 'asset wallet seeding verification failed: profiles %, wallet_rows %, nonzero_wallets %',
        v_profiles, v_wallet_rows, v_nonzero_wallets;
    end if;
  end if;
end
$verify$;

commit;
