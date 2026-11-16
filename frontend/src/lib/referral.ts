import { ApiError } from "./api";

/**
 * Referral / rewards data access.
 *
 * This module is the single seam between the referral UI and the backend. The
 * backend contract is not live yet, so every reader below has exactly two
 * honest outcomes:
 *
 *   1. The endpoint answers -> validated data is returned unchanged.
 *   2. The endpoint is not available -> an explicit, *empty* result with
 *      `available: false`, which the UI renders as "not open yet".
 *
 * There is deliberately no sample data, no percentage, no invented invite count
 * and no placeholder earnings anywhere in this file. A user must never be shown
 * a number that the backend did not produce.
 */

/** One settled or pending commission row, as returned by the backend. */
export interface ReferralCommissionRecord {
  /** Stable row id from the backend. */
  id: string;
  /** ISO timestamp of the qualifying event. */
  time: string;
  /** Display symbol of the asset the commission was paid in, e.g. "USDT". */
  asset: string;
  /** Decimal string as returned by the backend; never recomputed client-side. */
  amount: string;
  /** "pending" | "settled" — backend vocabulary, rendered through a status map. */
  status: string;
  /** Relationship level reported by the backend (1 or 2). */
  level: number;
}

export interface ReferralOverview {
  /** False when the referral programme is not enabled for this account yet. */
  available: boolean;
  /** Invite code, when the backend has issued one. */
  code?: string;
  /** Full invite URL, when the backend has issued one. */
  link?: string;
  /** Direct invitee count reported by the backend. */
  directCount?: number;
  /** Second-level invitee count reported by the backend. */
  indirectCount?: number;
  /** Cumulative settled commission, decimal string. */
  totalEarned?: string;
  /** Pending (unsettled) commission, decimal string. */
  pendingEarned?: string;
  /** Asset all amounts above are denominated in. */
  asset?: string;
}

export interface ReferralData {
  overview: ReferralOverview;
  records: ReferralCommissionRecord[];
}

/** Overlay is on when the backend reports the programme as not enabled. */
const NOT_AVAILABLE: ReferralOverview = { available: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Accepts only decimal strings the backend really sent; anything else is dropped. */
function decimalOrUndefined(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value.trim())) return value.trim();
  return undefined;
}

function countOrUndefined(value: unknown): number | undefined {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeRecord(raw: unknown): ReferralCommissionRecord | null {
  if (!isRecord(raw)) return null;
  const id = stringOrUndefined(raw.id) ?? stringOrUndefined(raw.record_id);
  const time = stringOrUndefined(raw.time) ?? stringOrUndefined(raw.created_at);
  const amount = decimalOrUndefined(raw.amount) ?? decimalOrUndefined(raw.commission);
  const asset = stringOrUndefined(raw.asset) ?? stringOrUndefined(raw.symbol);
  const level = countOrUndefined(raw.level);
  if (!id || !time || amount === undefined || !asset || level === undefined) return null;
  return {
    id,
    time,
    asset,
    amount,
    level,
    status: stringOrUndefined(raw.status) ?? "pending",
  };
}

/** Reads one authenticated referral endpoint, treating "not enabled" as an empty state. */
async function readReferralEndpoint<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(`/api/${path}`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    // The programme is simply not enabled for this account yet.
    if (response.status === 404 || response.status === 501) return null;
    if (!response.ok) return null;
    return (await response.json().catch(() => null)) as T | null;
  } catch (reason) {
    // A caller-initiated abort must propagate; anything else degrades to "not available".
    if (reason instanceof Error && reason.name === "AbortError") throw reason;
    return null;
  }
}

/**
 * Loads the referral overview and commission history.
 *
 * Returns `available: false` with no records whenever the backend has not
 * enabled the programme, so the caller can show an honest "not open yet"
 * surface instead of fake numbers.
 */
export async function getReferralData(signal?: AbortSignal): Promise<ReferralData> {
  const [overviewPayload, recordsPayload] = await Promise.all([
    readReferralEndpoint<{ ok?: boolean; profile?: unknown }>("referral/profile", signal),
    readReferralEndpoint<{ ok?: boolean; records?: unknown }>("referral/commissions", signal),
  ]);

  const profile = isRecord(overviewPayload) && isRecord(overviewPayload.profile) ? overviewPayload.profile : null;
  if (!profile) return { overview: NOT_AVAILABLE, records: [] };

  const overview: ReferralOverview = {
    available: true,
    code: stringOrUndefined(profile.code) ?? stringOrUndefined(profile.invite_code),
    link: stringOrUndefined(profile.link) ?? stringOrUndefined(profile.invite_link),
    directCount: countOrUndefined(profile.direct_count) ?? countOrUndefined(profile.level1_count),
    indirectCount: countOrUndefined(profile.indirect_count) ?? countOrUndefined(profile.level2_count),
    totalEarned: decimalOrUndefined(profile.total_earned) ?? decimalOrUndefined(profile.total),
    pendingEarned: decimalOrUndefined(profile.pending_earned) ?? decimalOrUndefined(profile.pending),
    asset: stringOrUndefined(profile.asset) ?? stringOrUndefined(profile.symbol),
  };

  const rawRecords = recordsPayload && isRecord(recordsPayload) && Array.isArray(recordsPayload.records)
    ? recordsPayload.records
    : [];
  const records = rawRecords.map(normalizeRecord).filter((row): row is ReferralCommissionRecord => row !== null);

  return { overview, records };
}

/** Invite share link, derived from the server-issued code only when a link is absent. */
export function referralShareUrl(overview: ReferralOverview): string | undefined {
  if (overview.link) return overview.link;
  if (!overview.code || typeof window === "undefined") return undefined;
  return `${window.location.origin}/register?ref=${encodeURIComponent(overview.code)}`;
}
