import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type Ref } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Menu, Check, LogIn } from "lucide-react";
import { useI18n, type Language } from "../../lib/i18n";
import { BrandLogo } from "../BrandLogo";
import { useAuth } from "../../lib/auth";

// Fixed menu order per product requirement. vi (Vietnamese) is legacy and intentionally omitted.
const LANGUAGE_MENU: Array<{ code: Language; label: string; flag: string }> = [
  { code: "ja", label: "日本語", flag: "🇯🇵" },
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "it", label: "Italiano", flag: "🇮🇹" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
];

const LANGUAGE_FLAG: Record<Language, string> = {
  ja: "🇯🇵", "zh-CN": "🇨🇳", en: "🇺🇸", es: "🇪🇸", de: "🇩🇪", it: "🇮🇹", pt: "🇵🇹",
};
const LANGUAGE_LABEL: Record<Language, string> = {
  ja: "日本語", "zh-CN": "中文", en: "English", es: "Español", de: "Deutsch", it: "Italiano", pt: "Português",
};

/**
 * Renders the global header, search control, and accessible language selector.
 * Keyboard navigation and dismissal are managed locally without changing route permissions.
 */
export function Topbar({ onMenuClick, menuOpen = false, menuButtonRef }: { menuButtonRef?: Ref<HTMLButtonElement>; onMenuClick?: () => void; menuOpen?: boolean }) {
  const { language, setLanguage, canChangeLanguage, t } = useI18n();
  const { status, email } = useAuth();
  const signedIn = status === "authenticated";
  const avatarLetter = (email || "U").trim().charAt(0).toUpperCase();

  const [search, setSearch] = useState("");
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const langTriggerRef = useRef<HTMLButtonElement>(null);
  const langItemsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!langMenuOpen) return;
    const close = (event: PointerEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) setLangMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLangMenuOpen(false);
        langTriggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    langItemsRef.current?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')?.focus();
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", onKey); };
  }, [langMenuOpen]);

  /**
   * Moves focus through language options using the menu's arrow, Home, and End keys.
   * Tab is allowed to leave the menu and closes it without trapping keyboard focus.
   */
  const handleLanguageMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Tab") {
      setLangMenuOpen(false);
      return;
    }
    const items = Array.from(langItemsRef.current?.querySelectorAll('[role="menuitemradio"]') ?? []) as HTMLButtonElement[];
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | undefined;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
    else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex !== undefined) {
      event.preventDefault();
      items[nextIndex].focus();
    }
  };

  /**
   * Navigates to the markets view for a non-empty search query.
   * Prevents the browser's default form submission behavior.
   */
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/markets?q=${encodeURIComponent(query)}` : "/markets");
  };

  return (
    <header className="relative z-30 flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-brand-border bg-brand-bg/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-xl sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button ref={menuButtonRef} type="button" aria-label={menuOpen ? t("Close navigation") : t("Open navigation")} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={onMenuClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <Link to="/home" aria-label="BTCBOX home" className="min-w-0 lg:hidden"><BrandLogo compact showExchange={false} /></Link>
        <form onSubmit={submitSearch} role="search" className="relative hidden min-w-0 max-[480px]:hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
          <input type="search" aria-label={t("Search BTCBOX")} value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search")} className="h-11 w-[min(30vw,190px)] rounded-xl border border-brand-border bg-brand-surface px-3 pl-10 pr-3 text-sm text-brand-text placeholder:text-brand-text-muted focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg md:w-[240px]" />
          <button type="submit" aria-label={t("Search BTCBOX")} className="sr-only">{t("Search")}</button>
        </form>
        <button type="button" aria-label={t("Search BTCBOX")} onClick={() => navigate("/markets")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text-secondary transition-colors hover:border-brand-accent/40 hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:hidden">
          <Search className="h-5 w-5" />
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        {canChangeLanguage && (
          <div ref={langMenuRef} className="relative">
            <button
              type="button"
              aria-label={t("Language")}
              ref={langTriggerRef}
              aria-haspopup="menu"
              aria-controls="language-menu"
              aria-expanded={langMenuOpen}
              onClick={() => setLangMenuOpen((open) => !open)}
              className="flex h-11 min-w-0 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface px-2.5 text-sm font-semibold text-brand-text transition-colors hover:border-brand-accent/40 hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:px-3"
            >
              <span aria-hidden="true" className="shrink-0 text-base leading-none">{LANGUAGE_FLAG[language]}</span>
              <span className="max-w-[5.5rem] truncate sm:max-w-none">{LANGUAGE_LABEL[language]}</span>
              <span aria-hidden="true" className={`text-xs text-brand-text-muted transition-transform ${langMenuOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>
            {langMenuOpen && (
              <div ref={langItemsRef} id="language-menu" role="menu" aria-orientation="vertical" aria-label={t("Language")} onKeyDown={handleLanguageMenuKeyDown} className="absolute right-0 z-50 mt-2 max-h-[min(70dvh,22rem)] w-44 max-w-[80vw] overflow-y-auto overscroll-contain rounded-lg border border-brand-border bg-brand-surface-2 py-1 shadow-xl shadow-black/40">
                {LANGUAGE_MENU.map(({ code, label, flag }) => {
                  const selected = language === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      onClick={() => { setLanguage(code); setLangMenuOpen(false); langTriggerRef.current?.focus(); }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:bg-brand-surface-hover ${selected ? "font-semibold text-brand-accent" : "text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text"}`}
                    >
                      <span className="flex min-w-0 items-center gap-2"><span aria-hidden="true" className="shrink-0 text-base leading-none">{flag}</span><span className="truncate">{label}</span></span>
                      {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {signedIn ? (
          <Link to="/me" aria-label={t("My account")} className="flex h-11 min-w-11 items-center gap-2 rounded-xl border border-brand-border bg-brand-surface px-2 text-brand-text-secondary transition-colors hover:border-brand-accent/40 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-accent/15 text-xs font-bold text-brand-accent">{avatarLetter}</span>
            <span className="hidden max-w-[140px] truncate text-xs font-semibold md:block">{email || t("My account")}</span>
          </Link>
        ) : (
          <Link to="/login" aria-label={t("Sign in")} className="flex h-11 items-center gap-1.5 rounded-xl border border-brand-accent/30 bg-brand-accent/10 px-3 text-xs font-semibold text-brand-accent transition-colors hover:border-brand-accent/50 hover:bg-brand-accent/[0.16] hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
            <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">{t("Sign in")}</span>
          </Link>
        )}
      </div>
    </header>
  );
}