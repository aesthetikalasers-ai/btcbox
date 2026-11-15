-- 0039_security_complexity_final_audit.sql - Final security audit and verification
-- This migration runs final verification checks after all security fixes are applied.
--
-- POST-FIX VERIFICATION CHECKLIST:
--
-- 1. Rate Limit Table Permissions (from 0023 fix)
SELECT has_table_privilege('anon', 'public.btcbox_rate_limits', 'SELECT, INSERT, UPDATE, DELETE') as anon_rate_limit_select,
       has_table_privilege('authenticated', 'public.btcbox_rate_limits', 'SELECT, INSERT, UPDATE, DELETE') as authed_rate_limit_select,
       has_table_privilege('service_role', 'public.btcbox_rate_limits', 'SELECT, INSERT, UPDATE, DELETE') as service_role_rate_limit;
--
-- Expected after fix: anon = false, authenticated = false (or limited SELECT), service_role = true
--
-- 2. Financial Sequences Permissions (from 0035 fix)
SELECT has_sequence_privilege('anon', 'public.financial_audit_log_id_seq', 'USAGE') as audit_seq_usage_anon,
       has_sequence_privilege('anon', 'public.financial_audit_log_id_seq', 'SELECT') as audit_seq_select_anon,
       has_sequence_privilege('service_role', 'public.financial_audit_log_id_seq', 'USAGE') as audit_seq_usage_service,
       has_sequence_privilege('service_role', 'public.financial_audit_log_id_seq', 'SELECT') as audit_seq_select_service,
       
       has_sequence_privilege('anon', 'public.financial_ledger_id_seq', 'USAGE') as ledger_seq_usage_anon,
       has_sequence_privilege('anon', 'public.financial_ledger_id_seq', 'SELECT') as ledger_seq_select_anon,
       has_sequence_privilege('service_role', 'public.financial_ledger_id_seq', 'USAGE') as ledger_seq_usage_service,
       has_sequence_privilege('service_role', 'public.financial_ledger_id_seq', 'SELECT') as ledger_seq_select_service;
--
-- Expected after fix: anon = false for USAGE/SELECT, service_role = true
--
-- 3. RLS Status Check on all 22 public tables
SELECT tablename, rowsecurity, force_rowlevel
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
--
-- Expected: rowsecurity = on for all tables, appropriate policies in place
--
-- 4. Private Schema Access Check
SELECT has_schema_privilege('anon', 'public', 'USAGE') as anon_schema_usage,
       has_schema_privilege('authenticated', 'public', 'USAGE') as authed_schema_usage;
--
-- Expected: both = false (Private Schema should be inaccessible to clients)
--
-- 5. Supabase Security Advisor Status
-- Run: supabase security advisor check
-- Verify: 0 critical issues remaining
--
-- 6. Leaked Password Protection Status
-- Check Supabase Dashboard > Authentication > Settings
-- Expected: Leaked password detection = ON
--
-- FINAL VERIFICATION QUERY
SELECT '=== SUPABASE SECURITY FIX VERIFICATION ===' as status,
       'Rate Limit Table: anon=' || has_table_privilege('anon', 'public.btcbox_rate_limits', 'SELECT')::text as anon_rate_limit,
       'Financial Sequences: audit_log USAGE anon=' || has_sequence_privilege('anon', 'public.financial_audit_log_id_seq', 'USAGE')::text as audit_usage,
       'Private Schema: anon USAGE=' || has_schema_privilege('anon', 'public', 'USAGE')::text as private_schema_access,
       'RPS Verification: See individual queries above' as next_steps;