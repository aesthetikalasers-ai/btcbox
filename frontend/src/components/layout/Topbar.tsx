import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftRight, CandlestickChart, Headset, Search, Sprout, TrendingUp, User } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { getSupportUnread } from "../../lib/api";
import { BrandLogo } from "../BrandLogo";
import { LanguageMenu } from "./LanguageMenu";
import { cn } from "../../lib/utils";
import { useAuthDialog } from "../../lib/auth-dialog";

/**
 * Trading products exposed in the header.
 *
 * The standalone "Markets" and "Trade" entries are intentionally absent: the
 * market list is reached through the ticker dropdown on each product page and
 * through search, which keeps this row single-line and information-dense like a
 * professional terminal. `/markets` and `/trade` stay reachable from the sidebar
 * and the mobile bottom bar.
 */
const PRODUCTS: Array<{ key: "spot" | "perpetual" | "seconds" | "earn"; label: string; to: string; icon: typeof TrendingUp }> = [
  { key: "spot", label: "Spot", to: "/trade/BTCUSDT", icon: CandlestickChart },
  { key: "perpetual", label: "Perpetual", to: "/contract", icon: TrendingUp },
  { key: "seconds", label: "Seconds", to: "/seconds", icon: ArrowLeftRight },
  { key: "earn", label: "Earn", to: "/earn", icon: Sprout },
];

function activeProduct(pathname: string): string | null {
  if (pathname.startsWith("/contract")) return "perpetual";
  if (pathname.startsWith("/seconds")) return "seconds";
  if (pathname.startsWith("/earn")) return "earn";
  if (/^\/trade\//.test(pathname)) return "spot";
  return null;
}
/**
 * Renders the global header, search control, quick market/trade entries,
 * language selector, and the authenticated account control.
 * Keyboard navigation and dismissal are managed locally without changing route permissions.
 */
export function Topbar() {
  const { t } = useI18n();
  const { status, email } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const { pathname } = useLocation();
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const authenticated = status === "authenticated";
  const active = activeProduct(pathname);
  const [supportUnread, setSupportUnread] = useState(0);
  // The shortcut hint has to match the platform: Mac users press ⌘, everyone
  // else presses Ctrl. Showing ⌘K on Windows sends users to a key they don't
  // have.
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
  const shortcutHint = isMac ? "⌘K" : "Ctrl K";

  // Unread support replies come from the backend counter (GET /api/chat/unread),
  // refreshed while the session is active so a staff reply is never missed.
  useEffect(() => {
    if (!authenticated) { setSupportUnread(0); return; }
    let live = true;
    const load = () => { getSupportUnread().then((count) => { if (live) setSupportUnread(count); }).catch(() => {}); };
    load();
    const timer = window.setInterval(load, 60000);
    return () => { live = false; window.clearInterval(timer); };
  }, [authenticated]);

  // Cmd/Ctrl+K focuses search, matching every terminal users already know.
  // Ignored while typing in another field so it never steals a keystroke.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : "/markets");
  };
  return (
    <header className="topbar relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-brand-bg/80 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4">
      {/* Faint top edge highlight: reads as glass without a visible gradient. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />

      <Link to="/home" aria-label="BTCBOX home" className="flex shrink-0 items-center">
        <BrandLogo variant="mark" className="h-8 w-8 brightness-110 contrast-110 drop-shadow-[0_0_6px_rgba(14,203,129,0.28)] sm:hidden" />
        <BrandLogo variant="white" className="hidden h-6 brightness-110 drop-shadow-[0_0_8px_rgba(14,203,129,0.22)] sm:inline-flex" />
      </Link>

      {/* Product tabs. The active item keeps a thin accent underline plus a soft
          glow, which survives a 56px bar far better than a filled pill. */}
      <nav aria-label={t("Trade products")} className="hidden min-w-0 items-center gap-0.5 md:flex">
        {PRODUCTS.map(({ key, label, to, icon: Icon }) => {
          const isActive = active === key;
          return (
            <Link
              key={key}
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex h-14 items-center gap-1.5 px-2.5 text-[13px] transition-colors",
                isActive ? "font-semibold text-brand-text" : "font-medium text-brand-text-muted hover:text-brand-text",
              )}
            >
              <Icon className={cn("h-[15px] w-[15px] shrink-0", isActive ? "text-brand-accent" : "text-brand-text-muted")} />
              <span className="whitespace-nowrap">{t(label)}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-opacity",
                  isActive ? "bg-brand-accent opacity-100 shadow-[0_0_10px_rgba(14,203,129,0.65)]" : "opacity-0",
                )}
              />
            </Link>
          );
        })}
      </nav>

      {/* Search takes the leftover space, capped so it never crowds the tabs. */}
      <form onSubmit={submitSearch} role="search" className="relative mx-auto hidden min-w-0 max-w-[420px] flex-1 lg:block">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-brand-text-muted" />
        <input
          ref={searchRef}
          type="search"
          aria-label={t("Search BTCBOX")}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("Search")}
          className="h-8 w-full rounded-md border border-white/[0.08] bg-white/[0.04] pl-8 pr-14 text-[13px] text-brand-text placeholder:text-brand-text-muted transition-colors focus:border-brand-accent/60 focus:bg-white/[0.06] focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/40"
        />
        <span aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-white/10 px-1 py-0.5 text-[10px] font-medium leading-none text-brand-text-muted">{shortcutHint}</span>
        <button type="submit" aria-label={t("Search BTCBOX")} className="sr-only">{t("Search")}</button>
      </form>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {authenticated ? (
          <Link
            to="/me"
            className="hidden h-8 min-w-0 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-2.5 text-[13px] font-semibold text-brand-text transition-colors hover:border-brand-accent/40 sm:flex"
            title={email || t("My")}
          >
            <User className="h-3.5 w-3.5 shrink-0 text-brand-accent" />
            <span className="max-w-[140px] truncate">{email || t("My")}</span>
          </Link>
        ) : (
          <>
            <div className="hidden items-center gap-1.5 sm:flex">
              <button
                type="button"
                onClick={() => openAuthDialog("login")}
                className="h-8 rounded-md px-3 text-[13px] font-semibold text-brand-text-secondary transition-colors hover:bg-white/[0.06] hover:text-brand-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/60"
              >
                {t("Sign in")}
              </button>
              {/* Primary action carries the only gradient in the chrome. */}
              <button
                type="button"
                onClick={() => openAuthDialog("register")}
                className="h-8 rounded-md bg-gradient-to-b from-[#19E08F] to-[#0ECB81] px-3.5 text-[13px] font-bold text-[#04140D] shadow-[0_0_0_1px_rgba(14,203,129,0.45),0_2px_10px_rgba(14,203,129,0.28)] transition-[filter,transform] hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70"
              >
                {t("Sign Up")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => openAuthDialog("login")}
              className="h-8 rounded-md bg-gradient-to-b from-[#19E08F] to-[#0ECB81] px-3 text-[13px] font-bold text-[#04140D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 sm:hidden"
            >
              {t("Sign in")}
            </button>
          </>
        )}

        <Link
          to="/support"
          aria-label={t("Support")}
          title={t("Support")}
          className="relative flex h-8 w-8 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:bg-white/[0.06] hover:text-brand-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-accent/60"
        >
          <Headset className="h-[17px] w-[17px]" />
          {supportUnread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-danger px-1 text-[10px] font-bold leading-none text-white tabular-nums" aria-label={t("Unread support replies")}>
              {supportUnread > 99 ? "99+" : supportUnread}
            </span>
          ) : null}
        </Link>
        <LanguageMenu />
      </div>
    </header>
  );
}
