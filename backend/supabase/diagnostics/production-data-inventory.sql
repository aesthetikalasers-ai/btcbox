-- BTCBOX production data inventory (READ ONLY).
-- Counts only; never returns user IDs, balances, addresses, tokens, sessions or row payloads.
-- Run before and after any separately approved staging rehearsal to compare preservation.
-- SELECT statements only. Do not use this as a substitute for a verified encrypted backup.

WITH table_counts(table_name, row_count) AS (
  SELECT 'btcbox_state', count(*)::bigint FROM public.btcbox_state
  UNION ALL SELECT 'financial_accounts', count(*) FROM public.financial_accounts
  UNION ALL SELECT 'financial_operations', count(*) FROM public.financial_operations
  UNION ALL SELECT 'financial_ledger', count(*) FROM public.financial_ledger
  UNION ALL SELECT 'financial_audit_log', count(*) FROM public.financial_audit_log
  UNION ALL SELECT 'deposit_records', count(*) FROM public.deposit_records
  UNION ALL SELECT 'withdrawal_requests', count(*) FROM public.withdrawal_requests
  UNION ALL SELECT 'earn_positions', count(*) FROM public.earn_positions
  UNION ALL SELECT 'earn_product_catalog', count(*) FROM public.earn_product_catalog
  UNION ALL SELECT 'financial_matching_markets', count(*) FROM public.financial_matching_markets
  UNION ALL SELECT 'financial_matching_orders', count(*) FROM public.financial_matching_orders
  UNION ALL SELECT 'financial_matching_trades', count(*) FROM public.financial_matching_trades
  UNION ALL SELECT 'seconds_contract_positions', count(*) FROM public.seconds_contract_positions
),
state_keys AS (
  SELECT k.key AS top_level_key,
         jsonb_typeof(s.data -> k.key) AS value_type,
         CASE
           WHEN jsonb_typeof(s.data -> k.key)='array' THEN jsonb_array_length(s.data -> k.key)
           WHEN jsonb_typeof(s.data -> k.key)='object'
             THEN (SELECT count(*) FROM jsonb_object_keys(s.data -> k.key))
           ELSE NULL
         END AS item_count,
         s.revision,
         s.updated_at
  FROM public.btcbox_state s
  CROSS JOIN LATERAL jsonb_object_keys(s.data) AS k(key)
  WHERE s.id='main'
)
SELECT 'TABLE_COUNT'::text AS category,
       table_name AS object_name,
       row_count::text AS detail
FROM table_counts
UNION ALL
SELECT 'STATE_KEY'::text AS category,
       top_level_key AS object_name,
       format('type=%s; item_count=%s; revision=%s; updated_at=%s',
         value_type, coalesce(item_count::text,'n/a'), revision, updated_at) AS detail
FROM state_keys
ORDER BY category, object_name;
