import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, User, ArrowLeftRight, ChartNoAxesCombined, Headset } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { getSupportUnread } from "../../lib/api";
import { BrandLogo } from "../BrandLogo";
import { LanguageMenu } from "./LanguageMenu";
import { Button } from "../ui/button";
import { useAuthDialog } from "../../lib/auth-dialog";
/**
 * Renders the global header, search control, quick market/trade entries,
 * language selector, and the authenticated account control.
 * Keyboard navigation and dismissal are managed locally without changing route permissions.
 */
export function Topbar() {
  const { t } = useI18n();
  const { status, email } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const authenticated = status === "authenticated";
  const [supportUnread, setSupportUnread] = useState(0);
  // Unread support replies come from the backend counter (GET /api/chat/unread),
  // refreshed while the session is active so a staff reply is never missed.
  useEffect(() => {
    if (!authenticated) { setSupportUnread(0); return; }
    let active = true;
    const load = () => { getSupportUnread().then((count) => { if (active) setSupportUnread(count); }).catch(() => {}); };
    load();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authenticated]);
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : "/markets");
  };
  return (
    <header className="relative z-30 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-brand-border bg-brand-bg/95 px-4 py-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl sm:px-5 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Link to="/home" aria-label="BTCBOX home" className="flex min-w-0 shrink-0 items-center">
          <BrandLogo variant="mark" className="sm:hidden" />
          <BrandLogo variant="white" className="hidden sm:inline-flex" />
        </Link>
        <form onSubmit={submitSearch} role="search" className="relative hidden min-w-0 sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
          <input type="search" aria-label={t("Search BTCBOX")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search")} className="h-11 w-[min(30vw,190px)] rounded-lg border border-brand-border bg-brand-surface-2 px-3 pl-10 pr-3 text-sm text-brand-text placeholder:text-brand-text-muted transition-colors focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50 md:w-[240px]" />
          <button type="submit" aria-label={t("Search BTCBOX")} className="sr-only">{t("Search")}</button>
        </form>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Quick market and trading entries, restored in the global header. */}
        <nav aria-label={t("Quick access")} className="hidden items-center gap-1 md:flex">
          <Link to="/markets" aria-label={t("Markets")} className="flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60">
            <ChartNoAxesCombined className="h-[17px] w-[17px]" />
            <span className="hidden xl:inline">{t("Markets")}</span>
          </Link>
          <Link to="/trade" aria-label={t("Trade")} className="flex h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60">
            <ArrowLeftRight className="h-[17px] w-[17px]" />
            <span className="hidden xl:inline">{t("Trade")}</span>
          </Link>
        </nav>
        <div aria-hidden="true" className="mx-1 hidden h-6 w-px bg-brand-border md:block" />
        {authenticated ? (
          <Link to="/me" className="hidden h-11 min-w-0 items-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-3 text-sm font-semibold text-brand-text transition-colors hover:border-brand-accent/40 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:flex" title={email || t("My")}>
            <User className="h-4 w-4 shrink-0 text-brand-accent" />
            <span className="max-w-[160px] truncate">{email || t("My")}</span>
          </Link>
        ) : (
          <>
            <div className="hidden items-center gap-2 sm:flex">
              <Button type="button" size="sm" variant="ghost" onClick={() => openAuthDialog("login")} className="h-9 rounded-full border border-brand-accent/30 bg-brand-accent/15 px-3.5 text-brand-accent transition-transform hover:scale-[1.03] active:scale-95">{t("Sign in")}</Button>
              <Button type="button" size="sm" onClick={() => openAuthDialog("register")} className="h-9">{t("Create account")}</Button>
            </div>
            <button type="button" onClick={() => openAuthDialog("login")} className="flex h-9 items-center rounded-full border border-brand-accent/30 bg-brand-accent/15 px-3.5 text-sm font-semibold text-brand-accent transition-transform hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:hidden">{t("Sign in")}</button>
          </>
        )}
        <Link to="/support" aria-label={t("Support")} title={t("Support")} className="relative flex h-9 items-center gap-1.5 rounded-lg border border-brand-border-subtle bg-brand-surface-2 px-2.5 text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/60">
          <Headset className="h-[17px] w-[17px]" />
          <span className="hidden text-sm font-semibold md:inline">{t("Support")}</span>
          {supportUnread > 0 ? <span className="absolute -right-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-danger px-1 text-[10px] font-bold leading-none text-white tabular-nums" aria-label={t("Unread support replies")}>{supportUnread > 99 ? "99+" : supportUnread}</span> : null}
        </Link>
        <LanguageMenu />
      </div>
    </header>
  );
}
