-- 0032_admin_audit_log_filter_indexes_v1.sql
-- The administrator audit-logs viewer (GET /api/admin/audit-logs) reads
-- public.financial_audit_log ordered by id desc, optionally filtered by
-- action=eq or subject_user_id=eq (uid filter). The primary key already covers
-- the unfiltered id-desc scan, and the existing subject index covers
-- subject+created_at. These two indexes cover the filtered-by-action and
-- filtered-by-subject id-desc access paths so the admin audit page does not
-- fall back to a full table scan as the audit log grows. Non-destructive;
-- uses IF NOT EXISTS and is safe to re-run.

create index if not exists financial_audit_action_id_desc_idx
  on public.financial_audit_log(action, id desc);

create index if not exists financial_audit_subject_id_desc_idx
  on public.financial_audit_log(subject_user_id, id desc);
