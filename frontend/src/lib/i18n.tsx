import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import english from "./locales/en.json";
import loadingMessages from "./locales/loading-messages.json";
import japanese from "./locales/ja.json";
import chinese from "./locales/zh-CN.json";
import spanishUrl from "./locales/es.json?url";
import portugueseUrl from "./locales/pt.json?url";
import italianUrl from "./locales/it.json?url";
import germanUrl from "./locales/de.json?url";

export type Language = "en" | "ja" | "zh-CN" | "es" | "pt" | "it" | "de";
type Dictionary = Record<string, string>;

export const localeTags: Record<Language, string> = {
  en: "en-US", ja: "ja-JP", "zh-CN": "zh-CN", es: "es-ES", pt: "pt-PT", it: "it-IT", de: "de-DE",
};

export function formatDecimalAmount(value: number | string | undefined | null, locale: string, maximumFractionDigits = 8) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString(locale, { maximumFractionDigits }) : "—";
  }

  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return "—";
  const [, negative, integer, fraction] = match;
  const parts = new Intl.NumberFormat(locale).formatToParts(-1234567.89);
  const group = parts.find((part) => part.type === "group")?.value ?? ",";
  const decimal = parts.find((part) => part.type === "decimal")?.value ?? ".";
  const minus = parts.find((part) => part.type === "minusSign")?.value ?? "-";
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, () => group);
  return (negative ? minus : "") + grouped + (fraction ? decimal + fraction : "");
}


// Keep default, fallback and the fixed Admin language available without a request. Other languages are
// fetched only when selected; the legacy Vietnamese dictionary stays in source.
const dictionaries: Partial<Record<Language, Dictionary>> = { en: english, ja: japanese, "zh-CN": chinese };
const dictionaryUrls = { es: spanishUrl, pt: portugueseUrl, it: italianUrl, de: germanUrl };
const pendingLoads = new Map<Language, Promise<Dictionary>>();

function loadDictionary(language: Language): Promise<Dictionary> {
  const cached = dictionaries[language];
  if (cached) return Promise.resolve(cached);
  const pending = pendingLoads.get(language);
  if (pending) return pending;
  const promise = (async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(dictionaryUrls[language as keyof typeof dictionaryUrls], { signal: controller.signal });
      if (!response.ok) throw new Error("Language request failed");
      const dictionary: unknown = await response.json();
      if (!dictionary || typeof dictionary !== "object" || Array.isArray(dictionary)
        || !Object.keys(english).every((key) => Object.hasOwn(dictionary, key)
          && typeof (dictionary as Dictionary)[key] === "string"
          && (dictionary as Dictionary)[key].trim() !== "")) {
        throw new Error("Invalid language dictionary");
      }
      dictionaries[language] = dictionary as Dictionary;
      return dictionary as Dictionary;
    } finally {
      window.clearTimeout(timeout);
    }
  })().finally(() => pendingLoads.delete(language));
  pendingLoads.set(language, promise);
  return promise;
}

type I18nValue = { language: Language; canChangeLanguage: boolean; setLanguage: (language: Language) => void; t: (value: string) => string };
const missingTranslationWarnings = new Set<string>();

function translateText(language: Language, text: string): string {
  const translated = dictionaries[language]?.[text] ?? loadingMessages[language][text];
  if (translated !== undefined) return translated;
  const warningKey = `${language}:${text}`;
  if (!missingTranslationWarnings.has(warningKey)) {
    missingTranslationWarnings.add(warningKey);
    console.warn(`[BTCBOX i18n] Missing ${language} translation for: ${text}`);
  }
  return english[text] ?? text;
}
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children, fixedLanguage }: { children: ReactNode; fixedLanguage?: Language }) {
  const [storedLanguage, setLanguageState] = useState<Language>(() => {
    let saved: string | null = null;
    try {
      saved = typeof window !== "undefined" ? window.localStorage.getItem("btcbox-language") : null;
    } catch {
      // Keep first-visit language selection usable when browser storage is unavailable.
    }
    return saved === "en" || saved === "ja" || saved === "zh-CN" || saved === "es" || saved === "it" || saved === "pt" || saved === "de" ? saved : "ja";
  });
  const requestedLanguage = fixedLanguage ?? storedLanguage;
  const [resolvedLanguage, setResolvedLanguage] = useState<Language | null>(() => dictionaries[requestedLanguage] ? requestedLanguage : null);
  const [failedLanguage, setFailedLanguage] = useState<Language | null>(null);
  const [retry, setRetry] = useState(0);
  const language = fixedLanguage ?? (dictionaries[requestedLanguage] ? requestedLanguage : resolvedLanguage ?? requestedLanguage);
  const pending = !dictionaries[requestedLanguage];
  const failed = pending && failedLanguage === requestedLanguage;

  useEffect(() => {
    let active = true;
    setFailedLanguage(null);
    loadDictionary(requestedLanguage).then(() => {
      if (!active) return;
      setResolvedLanguage(requestedLanguage);
      // Do not overwrite the customer's preference when visiting administration.
      if (!fixedLanguage) {
        try { window.localStorage.setItem("btcbox-language", requestedLanguage); } catch { /* Session-only preference. */ }
      }
    }).catch(() => {
      if (active) setFailedLanguage(requestedLanguage);
    });
    return () => { active = false; };
  }, [requestedLanguage, fixedLanguage, retry]);

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = localeTags[language];
    return () => { document.documentElement.lang = previous; };
  }, [language]);

  const value = useMemo(() => ({
    language,
    canChangeLanguage: !fixedLanguage,
    setLanguage: (next: Language) => {
      if (fixedLanguage) return;
      setFailedLanguage(null);
      setLanguageState(next);
    },
    t: (text: string) => translateText(language, text),
  }), [language, fixedLanguage]);
  // Keep mounted forms intact while a language change is loading or fails.
  // On a first visit, wait for the saved language before showing page content.
  const showContent = !pending || (resolvedLanguage !== null && !fixedLanguage);
  return <I18nContext.Provider value={value}>
    {pending && <div role={failed ? "alert" : "status"} aria-live="polite" className="flex flex-wrap items-center justify-center gap-3 border-b border-brand-border bg-brand-surface p-3 text-sm text-brand-text">
      <span>{value.t(failed ? "Unable to load this language. Please try again." : "Loading…")}</span>
      {!fixedLanguage && !resolvedLanguage && failed && <button type="button" onClick={() => setLanguageState("en")} className="min-h-11 rounded-lg border border-brand-border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">English</button>}
      {!fixedLanguage && resolvedLanguage && <button type="button" onClick={() => setLanguageState(resolvedLanguage)} className="min-h-11 rounded-lg px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">{value.t("Cancel")}</button>}
      {failed && <button type="button" onClick={() => setRetry((attempt) => attempt + 1)} className="min-h-11 rounded-lg border border-brand-border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">{value.t("Try again")}</button>}
    </div>}
    {showContent && children}
  </I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
