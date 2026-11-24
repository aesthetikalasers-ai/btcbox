// Status-code normalization + translated label helpers.
//
// The backend may return Chinese text (e.g. 持有中 / 已赎回), English codes, or
// case/underscore variants for the same logical status. Normalize at the
// boundary, then render via translated labels (never raw backend strings).

export type TFn = (key: string) => string;
export type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "warning" | "info" | "outline";

function normKey(raw: string | null | undefined): string {
  if (raw == null) return "";
  return String(raw).trim().toLowerCase().replace(/[\s_\-]+/g, "");
}

// ---------- Earn positions ----------
// DB: active | redeemed | matured (0002_financial_ledger_v1).
// Read API (0011_financial_read_api_earn_v1) maps active→持有中, redeemed→已赎回,
// matured passes through raw.
export type EarnStatus = "active" | "redeemed" | "settled" | "unknown";

export function normalizeEarnStatus(raw: string | null | undefined): EarnStatus {
  const s = normKey(raw);
  if (s === "持有中" || s === "holding" || s === "active" || s === "inforce") return "active";
  if (s === "已赎回" || s === "redeemed" || s === "redeem") return "redeemed";
  if (s === "已结算" || s === "已到期" || s === "settled" || s === "matured") return "settled";
  return "unknown";
}

export function earnStatusLabel(status: EarnStatus, t: TFn): string {
  switch (status) {
    case "active": return t("Active");
    case "redeemed": return t("Redeemed");
    case "settled": return t("Settled");
    default: return t("Unknown");
  }
}

export function earnStatusBadgeVariant(status: EarnStatus): BadgeVariant {
  if (status === "active") return "outline";
  return "secondary";
}

// ---------- Deposit records ----------
// DB (0002): pending | confirmed | rejected. 'processing' may appear as a variant.
export type DepositStatus = "confirmed" | "pending" | "processing" | "rejected" | "unknown";

export function normalizeDepositStatus(raw: string | null | undefined): DepositStatus {
  const s = normKey(raw);
  if (s === "confirmed" || s === "complete" || s === "completed" || s === "credited" || s === "success") return "confirmed";
  if (s === "processing" || s === "inprogress" || s === "pendingreview") return "processing";
  if (s === "pending" || s === "waiting" || s === "submitted") return "pending";
  if (s === "rejected" || s === "failed" || s === "cancelled" || s === "canceled") return "rejected";
  return "unknown";
}

export function depositStatusLabel(status: DepositStatus, t: TFn): string {
  switch (status) {
    case "confirmed": return t("Confirmed");
    case "pending": return t("Pending");
    case "processing": return t("Processing");
    case "rejected": return t("Rejected");
    default: return t("Unknown");
  }
}

export function depositStatusBadgeVariant(status: DepositStatus): BadgeVariant {
  if (status === "confirmed") return "success";
  if (status === "rejected") return "destructive";
  if (status === "unknown") return "secondary";
  return "warning";
}

// ---------- Withdrawal requests ----------
// DB (0022/0027): pending | pending_admin_review | approved | rejected | broadcast | failed | completed.
export type WithdrawalStatus = "completed" | "approved" | "processing" | "review" | "pending" | "rejected" | "failed" | "unknown";

export function normalizeWithdrawalStatus(raw: string | null | undefined): WithdrawalStatus {
  const s = normKey(raw);
  if (s === "completed" || s === "complete" || s === "paid" || s === "success") return "completed";
  if (s === "approved") return "approved";
  if (s === "broadcast" || s === "processing" || s === "sending") return "processing";
  if (s === "pendingadminreview" || s === "underreview" || s === "review") return "review";
  if (s === "pending" || s === "waiting" || s === "submitted") return "pending";
  if (s === "rejected" || s === "cancelled" || s === "canceled") return "rejected";
  if (s === "failed" || s === "error") return "failed";
  return "unknown";
}

export function withdrawalStatusLabel(status: WithdrawalStatus, t: TFn): string {
  switch (status) {
    case "completed": return t("Completed");
    case "approved": return t("Approved");
    case "processing": return t("Processing");
    case "review": return t("Under review");
    case "pending": return t("Pending");
    case "rejected": return t("Rejected");
    case "failed": return t("Failed");
    default: return t("Unknown");
  }
}

export function withdrawalStatusBadgeVariant(status: WithdrawalStatus): BadgeVariant {
  if (status === "completed" || status === "approved") return "success";
  if (status === "rejected" || status === "failed") return "destructive";
  if (status === "unknown") return "secondary";
  return "warning";
}

// ---------- Spot orders ----------
// DB (0008): open | partially_filled | filled | cancelled.
export type OrderStatus = "open" | "partially_filled" | "filled" | "cancelled" | "unknown";

export function normalizeOrderStatus(raw: string | null | undefined): OrderStatus {
  const s = normKey(raw);
  if (s === "open" || s === "new" || s === "pending") return "open";
  if (s === "partiallyfilled" || s === "partial") return "partially_filled";
  if (s === "filled" || s === "completed" || s === "closed" || s === "success") return "filled";
  if (s === "cancelled" || s === "canceled" || s === "rejected" || s === "expired") return "cancelled";
  return "unknown";
}

export function orderStatusLabel(status: OrderStatus, t: TFn): string {
  switch (status) {
    case "open": return t("Open");
    case "partially_filled": return t("Partially filled");
    case "filled": return t("Filled");
    case "cancelled": return t("Cancelled");
    default: return t("Unknown");
  }
}

export function orderStatusBadgeVariant(status: OrderStatus): BadgeVariant {
  if (status === "filled") return "success";
  if (status === "cancelled") return "destructive";
  if (status === "unknown") return "secondary";
  return "outline";
}

// ---------- KYC / identity verification ----------
export type KycStatus = "verified" | "review" | "rejected" | "not_submitted" | "unknown";

export function normalizeKycStatus(raw: string | null | undefined): KycStatus {
  const s = normKey(raw);
  if (s === "verified" || s === "approved" || s === "accepted" || s === "success") return "verified";
  if (s === "rejected" || s === "failed" || s === "declined") return "rejected";
  if (s === "notsubmitted" || s === "none" || s === "unverified" || s === "") return "not_submitted";
  return "review"; // pending / processing / under_review / submitted all fall here
}

export function kycStatusLabel(status: KycStatus, t: TFn): string {
  switch (status) {
    case "verified": return t("Verified");
    case "review": return t("Under review");
    case "rejected": return t("Rejected");
    case "not_submitted": return t("Not submitted");
    default: return t("Unknown");
  }
}

export function kycStatusBadgeVariant(status: KycStatus): BadgeVariant {
  if (status === "verified") return "success";
  if (status === "rejected") return "destructive";
  if (status === "not_submitted" || status === "unknown") return "secondary";
  return "warning";
}

// ---------- Seconds contract positions ----------
// DB (0014): open | settled.
export type SecondsStatus = "open" | "settled" | "unknown";

export function normalizeSecondsStatus(raw: string | null | undefined): SecondsStatus {
  const s = normKey(raw);
  if (s === "open" || s === "active" || s === "持有中") return "open";
  if (s === "settled" || s === "closed" || s === "已结算") return "settled";
  return "unknown";
}

export function secondsStatusLabel(status: SecondsStatus, t: TFn): string {
  switch (status) {
    case "open": return t("Open");
    case "settled": return t("Settled");
    default: return t("Unknown");
  }
}

export function secondsStatusBadgeVariant(status: SecondsStatus): BadgeVariant {
  if (status === "settled") return "secondary";
  if (status === "unknown") return "secondary";
  return "outline";
}

// ---------- KYC identity document type ----------
// Backend may return id_card / passport / driver_license with case,
// underscore or hyphen variants (e.g. "driver-license", "DriverLicense").
export type KycDocumentType = "id_card" | "passport" | "driver_license" | "unknown";
export function normalizeKycDocumentType(raw: string | null | undefined): KycDocumentType {
  const s = normKey(raw);
  if (s === "idcard" || s === "nationalidcard" || s === "nationalid" || s === "id" || s === "identitycard") return "id_card";
  if (s === "passport") return "passport";
  if (s === "driverlicense" || s === "driverslicense" || s === "drivinglicense" || s === "driverlicence" || s === "drivinglicence") return "driver_license";
  return "unknown";
}
export function kycDocumentTypeLabel(docType: KycDocumentType, t: TFn): string {
  switch (docType) {
    case "id_card": return t("National ID card");
    case "passport": return t("Passport");
    case "driver_license": return t("Driver license");
    default: return t("Unknown");
  }
}
