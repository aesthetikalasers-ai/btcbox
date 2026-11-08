-- Remove the duplicate subject/created_at index created by 0021.
-- 0002 already creates financial_audit_subject_time_idx with the same key order.
-- Keep the original index and avoid redundant write/storage overhead.
drop index if exists public.financial_audit_subject_created_idx;
