import { useState, type FormEvent, type Ref } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, User, Menu, ArrowLeftRight, ChartNoAxesCombined } from "lucide-react";
import { useI18n } from "../../lib/i18n";
import { useAuth } from "../../lib/auth";
import { BrandLogo } from "../BrandLogo";
import { LanguageMenu } from "./LanguageMenu";
import { Button } from "../ui/button";
/**
 * Renders the global header, search control, quick market/trade entries,
 * language selector, and the authenticated account control.
 * Keyboard navigation and dismissal are managed locally without changing route permissions.
 */
export function Topbar({ onMenuClick, menuOpen = false, menuButtonRef }: { menuButtonRef?: Ref<HTMLButtonElement>; onMenuClick?: () => void; menuOpen?: boolean }) {
  const { t } = useI18n();
  const { status, email } = useAuth();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const authenticated = status === "authenticated";
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : "/markets");
  };
  return (
    <header className="relative z-30 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-brand-border bg-brand-bg/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button ref={menuButtonRef} type="button" aria-label={menuOpen ? t("Close navigation") : t("Open navigation")} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={onMenuClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <Link to="/home" aria-label="BTCBOX home" className="min-w-0 lg:hidden"><BrandLogo compact showExchange={false} /></Link>
        <form onSubmit={submitSearch} role="search" className="relative hidden min-w-0 max-[480px]:hidden sm:block">
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
              <Button asChild size="sm" variant="ghost" className="h-11"><Link to="/login">{t("Sign in")}</Link></Button>
              <Button asChild size="sm" className="h-11"><Link to="/register">{t("Create account")}</Link></Button>
            </div>
            <Link to="/login" className="flex h-9 items-center rounded-lg px-2.5 text-sm font-semibold text-brand-accent transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:hidden">{t("Sign in")}</Link>
          </>
        )}
        <LanguageMenu />
      </div>
    </header>
  );
}
