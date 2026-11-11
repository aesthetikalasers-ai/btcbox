import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useI18n, type Language } from "../../lib/i18n";

// Fixed menu order per product requirement. vi (Vietnamese) is legacy and intentionally omitted.
// `english` is metadata used only for search matching; it is not rendered as UI copy.
const LANGUAGES: Array<{ code: Language; label: string; english: string; flag: string }> = [
  { code: "ja", label: "日本語", english: "Japanese", flag: "🇯🇵" },
  { code: "zh-CN", label: "中文", english: "Chinese", flag: "🇨🇳" },
  { code: "en", label: "English", english: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", english: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "Deutsch", english: "German", flag: "🇩🇪" },
  { code: "it", label: "Italiano", english: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Português", english: "Portuguese", flag: "🇵🇹" },
];

const LANGUAGE_LABEL: Record<Language, string> = {
  ja: "日本語", "zh-CN": "中文", en: "English", es: "Español", de: "Deutsch", it: "Italiano", pt: "Português",
};

export function LanguageMenu() {
  const { language, setLanguage, canChangeLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((lang) =>
      lang.label.toLowerCase().includes(q)
      || lang.english.toLowerCase().includes(q)
      || lang.code.toLowerCase().includes(q),
    );
  }, [query]);

  // Keep the highlighted row inside the filtered list whenever the filter changes.
  useEffect(() => { setHighlight((current) => Math.min(current, Math.max(filtered.length - 1, 0))); }, [filtered.length]);

  // Close on outside click; Escape closes and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // On open: clear the query, highlight the currently selected language, focus the search field.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const selectedIndex = LANGUAGES.findIndex((lang) => lang.code === language);
    setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, language]);

  // Keep the highlighted row visible while navigating with the keyboard.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  if (!canChangeLanguage) return null;

  const select = (code: Language) => {
    setLanguage(code);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((current) => Math.max(0, Math.min(current + 1, filtered.length - 1)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[highlight];
      if (item) select(item.code);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("Language")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 min-w-0 items-center gap-1.5 rounded-lg border border-brand-border bg-brand-surface px-2.5 text-sm font-semibold text-brand-text transition-colors hover:border-brand-accent/40 hover:bg-brand-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent sm:px-3"
      >
        <span aria-hidden="true" className="text-base leading-none">🌐</span>
        <span className="max-w-[5.5rem] truncate sm:max-w-none">{LANGUAGE_LABEL[language]}</span>
        <ChevronDown aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 text-brand-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("Language")}
          className="absolute right-0 z-50 mt-2 w-72 max-w-[85vw] overflow-hidden rounded-xl border border-brand-border bg-brand-surface-2 shadow-xl shadow-black/40"
        >
          <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-3">
            <span className="type-card-title text-brand-text">{t("Language")}</span>
            <button
              type="button"
              aria-label={t("Close")}
              onClick={() => { setOpen(false); triggerRef.current?.focus(); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="px-3 pb-2">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={t("Search Language")}
                aria-label={t("Search Language")}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={filtered.length > 0}
                aria-controls={filtered.length > 0 ? listboxId : undefined}
                aria-activedescendant={filtered[highlight] ? `${listboxId}-${filtered[highlight].code}` : undefined}
                className="h-11 w-full rounded-lg border border-brand-border bg-brand-surface-2 pl-9 pr-3 text-sm text-brand-text placeholder:text-brand-text-muted transition-colors focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/50"
              />
            </div>
          </div>

          <div className="custom-scrollbar max-h-72 overflow-y-auto px-1.5 pb-2">
            {filtered.length === 0 ? (
              <p role="status" className="px-3 py-6 text-center text-sm text-brand-text-muted">{t("No matching language")}</p>
            ) : (
              <div id={listboxId} role="listbox" aria-label={t("Language")}>
              {filtered.map((lang, index) => {
                const selected = language === lang.code;
                const active = index === highlight;
                return (
                  <button
                    key={lang.code}
                    ref={(element) => { itemRefs.current[index] = element; }}
                    type="button"
                    id={`${listboxId}-${lang.code}`}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    onClick={() => select(lang.code)}
                    onMouseEnter={() => setHighlight(index)}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-accent/50 ${
                      selected
                        ? "bg-brand-accent/15 font-semibold text-brand-accent"
                        : active
                          ? "bg-brand-surface-hover text-brand-text"
                          : "text-brand-text-secondary hover:bg-brand-surface-hover hover:text-brand-text"
                    }`}
                  >
                    <span aria-hidden="true" className="w-6 shrink-0 text-center text-base leading-none">{lang.flag}</span>
                    <span className="min-w-0 flex-1 truncate">{lang.label}</span>
                    {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
