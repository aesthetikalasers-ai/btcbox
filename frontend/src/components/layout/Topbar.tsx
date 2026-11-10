import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, User, Menu, Globe, ChevronDown, Check } from "lucide-react";
import { useI18n, type Language } from "../../lib/i18n";
import { BrandLogo } from "../BrandLogo";

const languageOptions: { value: Language; label: string; compactLabel: string }[] = [
  { value: "en", label: "English", compactLabel: "English" },
  { value: "ja", label: "日本語", compactLabel: "日本語" },
  { value: "zh-CN", label: "中文", compactLabel: "中文" },
  { value: "es", label: "Español", compactLabel: "Español" },
  { value: "de", label: "Deutsch", compactLabel: "Deutsch" },
  { value: "it", label: "Italiano", compactLabel: "Italiano" },
  { value: "pt", label: "Português", compactLabel: "Português" },
];

export function Topbar({ onMenuClick, menuOpen = false }: { onMenuClick?: () => void; menuOpen?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : "/markets");
  };
  const currentLanguage = languageOptions.find((option) => option.value === language) ?? languageOptions[0];

  return (
    <header className="relative z-30 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-brand-border bg-brand-bg/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button type="button" aria-label={menuOpen ? t("Close navigation") : t("Open navigation")} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={onMenuClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <Link to="/home" aria-label="BTCBOX home" className="min-w-0 lg:hidden"><BrandLogo compact showExchange={false} /></Link>
        <form onSubmit={submitSearch} role="search" className="relative hidden min-w-0 max-[480px]:hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
          <input type="search" aria-label={t("Search BTCBOX")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search")} className="h-11 w-[min(30vw,190px)] rounded-xl border border-brand-border bg-brand-surface px-3 pl-10 pr-3 text-sm text-brand-text placeholder:text-brand-text-muted focus:border-brand-accent focus:outline-none md:w-[240px]" />
          <button type="submit" aria-label={t("Search BTCBOX")} className="sr-only">{t("Search")}</button>
        </form>
        <button type="button" aria-label={t("Search BTCBOX")} onClick={() => navigate("/markets")} className="hidden h-11 w-11 items-center justify-center rounded-xl text-brand-text-secondary hover:bg-brand-surface-hover sm:hidden">
          <Search className="h-5 w-5" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <details className="group relative">
          <summary
            aria-label={t("Language")}
            title={t("Language")}
            className="flex h-11 w-[100px] cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-2 text-sm font-semibold text-brand-text transition-colors hover:border-brand-accent/50 hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent [&::-webkit-details-marker]:hidden sm:w-[112px]"
          >
            <Globe className="h-4 w-4 shrink-0 text-brand-text-secondary" />
            <span className="min-w-0 truncate">{currentLanguage.compactLabel}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-brand-text-muted transition-transform group-open:rotate-180" />
          </summary>
          <div role="group" aria-label={t("Language")} className="absolute right-0 top-full z-50 mt-2 w-40 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-brand-border bg-[#111c2e] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
            {languageOptions.map((option) => {
              const selected = option.value === language;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={(event) => {
                    setLanguage(option.value);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent ${selected ? "bg-brand-accent/15 font-semibold text-brand-text" : "text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text"}`}
                >
                  <span className="truncate">{option.label}</span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </details>
        <Link to="/me" aria-label={t("My")} className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text-secondary transition-colors hover:border-brand-accent/40 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
          <User className="h-[18px] w-[18px]" />
        </Link>
      </div>
    </header>
  );
}
