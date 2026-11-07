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
users AS (
  SELECT u.value AS user_data
  FROM public.btcbox_state s
  CROSS JOIN LATERAL jsonb_each(s.data -> 'users') AS u(user_key,value)
  WHERE s.id='main'
),
user_balance_slots AS (
  SELECT u.user_data,
         b.balance ->> 'free' AS free_amount,
         b.balance ->> 'frozen' AS frozen_amount
  FROM users u
  CROSS JOIN LATERAL jsonb_each(u.user_data -> 'balances') AS b(asset,balance)
),
user_summary AS (
  SELECT
    (SELECT count(*) FROM users) AS total_users,
    (SELECT count(*) FROM users WHERE nullif(user_data ->> 'username','') IS NOT NULL) AS users_with_username,
    (SELECT count(*) FROM users WHERE nullif(user_data ->> 'login_password_hash','') IS NOT NULL) AS users_with_btcbox_login_password,
    (SELECT count(*) FROM users WHERE nullif(user_data ->> 'supabase_user_id','') IS NOT NULL) AS users_with_supabase_link,
    (SELECT count(*) FROM users WHERE jsonb_typeof(user_data -> 'wallet_identities')='array'
      AND jsonb_array_length(user_data -> 'wallet_identities')>0) AS users_with_wallet_link,
    (SELECT count(DISTINCT user_data) FROM user_balance_slots
      WHERE coalesce(free_amount,'0')::numeric<>0 OR coalesce(frozen_amount,'0')::numeric<>0) AS users_with_nonzero_balance,
    (SELECT coalesce(sum(jsonb_array_length(user_data -> 'deposits')),0) FROM users) AS embedded_deposit_records,
    (SELECT coalesce(sum(jsonb_array_length(user_data -> 'withdrawals')),0) FROM users) AS embedded_withdrawal_records,
    (SELECT coalesce(sum(jsonb_array_length(user_data -> 'orders')),0) FROM users) AS embedded_order_records,
    (SELECT coalesce(sum(jsonb_array_length(user_data -> 'earn_records')),0) FROM users) AS embedded_earn_records,
    (SELECT coalesce(sum(jsonb_array_length(user_data -> 'support_messages')),0) FROM users) AS embedded_support_messages
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
SELECT 'USER_SUMMARY'::text AS category,
       'users' AS object_name,
       format('total=%s; usernames=%s; BTCBOX login passwords=%s; Supabase links=%s; wallet links=%s; users with nonzero balances=%s; embedded deposits=%s; withdrawals=%s; orders=%s; earn records=%s; support messages=%s',
         total_users, users_with_username, users_with_btcbox_login_password,
         users_with_supabase_link, users_with_wallet_link, users_with_nonzero_balance,
         embedded_deposit_records, embedded_withdrawal_records, embedded_order_records,
         embedded_earn_records, embedded_support_messages) AS detail
FROM user_summary
UNION ALL
SELECT 'STATE_KEY'::text AS category,
       top_level_key AS object_name,
       format('type=%s; item_count=%s; revision=%s; updated_at=%s',
         value_type, coalesce(item_count::text,'n/a'), revision, updated_at) AS detail
FROM state_keys
ORDER BY category, object_name;
