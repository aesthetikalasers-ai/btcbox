import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, User, Menu, Languages } from "lucide-react";
import { useI18n, type Language } from "../../lib/i18n";
import { BrandLogo } from "../BrandLogo";

export function Topbar({ onMenuClick, menuOpen = false }: { onMenuClick?: () => void; menuOpen?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : "/markets");
  };

  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-brand-border bg-brand-bg/95 shadow-[0_1px_0_rgba(255,255,255,0.035)] px-3 backdrop-blur-xl sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button type="button" aria-label={menuOpen ? t("Close navigation") : t("Open navigation")} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={onMenuClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <Link to="/home" aria-label="BTCBOX home" className="min-w-0 sm:hidden"><BrandLogo compact showExchange={false} /></Link>
        <form onSubmit={submitSearch} role="search" className="relative hidden min-w-0 max-[480px]:hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
          <input type="search" aria-label={t("Search BTCBOX")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search")} className="h-11 w-[min(30vw,190px)] rounded-xl border border-brand-border bg-brand-surface px-3 pl-10 pr-3 text-sm text-brand-text placeholder:text-brand-text-muted transition-colors focus:border-brand-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/30 md:w-[240px]" />
          <button type="submit" aria-label={t("Search BTCBOX")} className="sr-only">{t("Search")}</button>
        </form>
        <button type="button" aria-label={t("Search BTCBOX")} onClick={() => navigate("/markets")} className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-text-secondary transition-colors hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 sm:hidden">
          <Search className="h-5 w-5" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <label className="flex h-11 items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-2 text-brand-text-secondary transition-colors focus-within:border-brand-accent/50 focus-within:ring-2 focus-within:ring-brand-accent/20 sm:px-2.5">
          <Languages className="h-4 w-4 shrink-0" />
          <select aria-label={t("Language")} value={language} onChange={(event) => setLanguage(event.target.value as Language)} className="w-[74px] bg-transparent text-xs font-semibold text-brand-text outline-none sm:w-[88px]">
            <option value="en">English</option><option value="ja">日本語</option><option value="zh-CN">简体中文</option><option value="es">Español</option><option value="vi">Tiếng Việt</option><option value="it">Italiano</option><option value="pt">Português</option>
          </select>
        </label>
        <Link to="/me" aria-label={t("My")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text-secondary transition-colors hover:border-brand-accent/40 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
          <User className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
