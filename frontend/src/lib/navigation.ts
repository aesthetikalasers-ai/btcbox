import { useMemo } from "react";

/**
 * Navigation tier of a route.
 *
 * - `top`: a first-class product surface (Home, Markets, Trade, Assets, Account).
 *   These keep the global logo header plus the fixed 5-tab bottom navigation and
 *   never render a back affordance, because there is nowhere "up" to go.
 * - `sub`: a detail surface reached *from* a top-level page (Orders, Deposit,
 *   Withdraw, Settings, Chart details...). These hide the global header and the
 *   bottom tab bar and instead render the secondary navigation bar.
 * - `standalone`: self-contained flows that own their whole viewport, such as the
 *   authentication screens. No shell chrome is applied at all.
 */
export type NavigationTier = "top" | "sub" | "standalone";

/** Routes that render without the application chrome (owned by their own screen). */
export const STANDALONE_ROUTES = ["/login", "/register", "/account-setup", "/auth/react-callback"] as const;

/** Routes that are entered *from* a top-level tab and need a back affordance. */
export const SUB_PAGE_ROUTES = [
  "/orders",
] as const;

/**
 * Sub-page routes that are documented but not yet migrated to `SubPageLayout`.
 *
 * These intentionally keep the top-level chrome for now. Moving a path here would
 * remove its global header and bottom tab bar without a replacement navigation
 * surface, so a route may only move into `SUB_PAGE_ROUTES` in the same change that
 * wraps the page in `SubPageLayout`.
 *
 * Pending migration: /deposit, /withdraw, /settings, /kyc, /earn, /seconds,
 * /contract, /support, /trade-hub.
 */
export const PENDING_SUB_PAGE_ROUTES = [
  "/deposit",
  "/withdraw",
  "/settings",
  "/kyc",
  "/earn",
  "/seconds",
  "/contract",
  "/support",
  "/trade-hub",
] as const;

/**
 * Child detail routes that will be nested under a top-level page while remaining a
 * sub-page tier. Kept empty on purpose: a pattern only belongs here once its route
 * is registered *and* the page renders `SubPageLayout`. Matching a path that has no
 * sub-page wrapper would strip the chrome and leave the screen with no navigation.
 *
 * Planned additions: /trade/:symbol/chart (chart details), /orders/:id (order details).
 */
export const SUB_PAGE_ROUTE_PATTERNS: readonly RegExp[] = [
  /^\/chart\/[^/]+$/,
];

/** Fallback destination used when history has no in-app entry to return to. */
const TIER_FALLBACK: Record<Exclude<NavigationTier, "top">, string> = {
  sub: "/home",
  standalone: "/home",
};

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed.toLowerCase();
}

/**
 * Resolves the navigation tier for a pathname.
 * Pure function so both the layout shell and the secondary bar agree on one source
 * of truth instead of duplicating route lists.
 */
export function getNavigationTier(pathname: string): NavigationTier {
  const path = normalizePath(pathname);
  if ((STANDALONE_ROUTES as readonly string[]).includes(path)) return "standalone";
  if ((SUB_PAGE_ROUTES as readonly string[]).includes(path)) return "sub";
  if (SUB_PAGE_ROUTE_PATTERNS.some((pattern) => pattern.test(path))) return "sub";
  return "top";
}

export function getTierFallback(tier: NavigationTier): string {
  return tier === "top" ? "/home" : TIER_FALLBACK[tier];
}

/**
 * Tracks browser history depth so a sub-page can decide between a true
 * `history.back()` and a deterministic fallback push when the user deep-linked
 * straight into a sub-page (opened a bookmark, refreshed, or came from an external
 * site). Without this, `back()` would leave BTCBOX entirely.
 */
export function useHistoryDepth() {
  return useMemo(() => {
    if (typeof window === "undefined") return 0;
    const state = window.history.state as { idx?: number } | null;
    return typeof state?.idx === "number" ? state.idx : 0;
  }, []);
}

export function useNavigationTier(pathname: string): NavigationTier {
  return useMemo(() => getNavigationTier(pathname), [pathname]);
}
