export type AdminTab = "overview" | "users" | "deposit-records" | "deposits" | "withdrawals" | "financial-adjustments" | "kyc" | "audit" | "orders" | "support" | "support-faq" | "payout-addresses" | "admins" | "seconds" | "markets" | "assets";

export const ADMIN_TABS: Array<{ id: AdminTab; label: string; permission: string }> = [
  { id: "overview", label: "Overview", permission: "dashboard.read" },
  { id: "users", label: "Users", permission: "users.read" },
  { id: "deposit-records", label: "Deposit records", permission: "deposits.read" },
  { id: "deposits", label: "Deposit settings", permission: "system_config.read" },
  { id: "withdrawals", label: "Withdrawals", permission: "withdrawals.read" },
  { id: "financial-adjustments", label: "Manual credit / debit", permission: "users.read" },
  { id: "kyc", label: "KYC", permission: "kyc.read" },
  { id: "audit", label: "Audit log", permission: "financial_audit.read" },
  { id: "orders", label: "Orders", permission: "orders.read" },
  { id: "support", label: "Support", permission: "support.read" },
  { id: "payout-addresses", label: "Bank payout details", permission: "payout_addresses.read_sensitive" },
  { id: "support-faq", label: "Help centre", permission: "support.manage" },
  { id: "seconds", label: "Seconds contracts", permission: "seconds_policy.read" },
  { id: "assets", label: "Asset configuration", permission: "system_config.read" },
  { id: "markets", label: "Spot & Perpetual markets", permission: "system_config.read" },
];

export const ADMIN_TAB_GROUPS: Array<{ id: string; label: string; tabs: AdminTab[] }> = [
  { id: "workspace", label: "Workspace", tabs: ["overview"] },
  { id: "users", label: "User centre", tabs: ["users", "kyc"] },
  { id: "finance", label: "Finance centre", tabs: ["deposit-records", "deposits", "withdrawals", "financial-adjustments", "payout-addresses"] },
  { id: "market-config", label: "Market configuration", tabs: ["assets", "markets"] },
  { id: "trading", label: "Trading operations", tabs: ["orders", "seconds"] },
  { id: "support", label: "Support centre", tabs: ["support", "support-faq"] },
  { id: "audit", label: "Audit centre", tabs: ["audit"] },
  { id: "system", label: "System", tabs: ["admins"] },
];
