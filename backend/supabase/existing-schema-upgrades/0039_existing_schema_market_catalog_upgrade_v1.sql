-- Incremental upgrade for an existing BTCBOX schema that already has the
-- matching-engine tables but predates the administrative market catalogue RPC.
-- This is intentionally excluded from the empty-database bootstrap inventory.
-- It does not enable financial matching; the runtime FINANCIAL_* flags remain
-- the only authority for order entry and balance-changing operations.

DO $$
BEGIN
  IF to_regclass('public.financial_matching_markets') IS NULL THEN
    RAISE EXCEPTION 'financial_matching_markets is required before applying market catalogue upgrade';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.read_spot_market_snapshot_v1()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $read$
  SELECT jsonb_build_object(
    'ok', true,
    'markets', coalesce(jsonb_agg(jsonb_build_object(
      'base_asset', base_asset,
      'quote_asset', quote_asset,
      'enabled', enabled,
      'price_tick', price_tick,
      'quantity_step', quantity_step,
      'min_quantity', min_quantity,
      'min_notional', min_notional,
      'min_limit_price', min_limit_price,
      'max_limit_price', max_limit_price,
      'maker_fee_rate', maker_fee_rate,
      'taker_fee_rate', taker_fee_rate,
      'updated_at', updated_at
    ) ORDER BY base_asset, quote_asset), '[]'::jsonb)
  )
  FROM public.financial_matching_markets;
$read$;

REVOKE ALL ON FUNCTION public.read_spot_market_snapshot_v1()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.read_spot_market_snapshot_v1() TO service_role;

-- Public quotes need an operator-owned catalogue even while financial writes
-- remain disabled. Existing configured values always win during this upgrade.
INSERT INTO public.financial_matching_markets(
  base_asset, quote_asset, enabled, price_tick, quantity_step, min_quantity, min_notional
) VALUES
  ('BTC', 'USDT', true, 0.01, 0.000001, 0.000001, 1),
  ('ETH', 'USDT', true, 0.01, 0.00001, 0.00001, 1),
  ('SOL', 'USDT', true, 0.001, 0.001, 0.001, 1),
  ('BNB', 'USDT', true, 0.01, 0.001, 0.001, 1)
ON CONFLICT (base_asset, quote_asset) DO NOTHING;

COMMENT ON FUNCTION public.read_spot_market_snapshot_v1() IS
  'Service-role-only, fail-closed market catalogue read for public quote endpoints.';
