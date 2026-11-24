import * as Dialog from "@radix-ui/react-dialog";
import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { localeTags, useI18n } from "../../lib/i18n";

/**
 * One selectable row of the market picker.
 *
 * Market values are optional and must come from the live market snapshot.
 * Missing fields render as an em dash; the picker never invents quote data.
 */
export interface MarketPickerItem {
  /** Unique key (e.g. "BTCUSDT"). */
  id: string;
  /** Primary label (e.g. "BTC/USDT" or "BTCUSDT"). */
  label: string;
  /** Optional live price; null renders an em dash, never a made-up value. */
  price?: string | null;
  /** Optional 24h change in percent; null renders an em dash. */
  changePct?: number | null;
  /** Optional 24h quote turnover in USDT, taken from the market ticker. */
  quoteVolume?: string | number | null;
}

interface MarketPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MarketPickerItem[];
  /** Currently selected item id, highlighted in the list. */
  activeId?: string;
  /** Called with the chosen item's id. */
  onSelect: (id: string) => void;
  /** Body copy for the sr-only description. */
  description: string;
  /** Shown when the list is empty (no markets enabled / no search match). */
  emptyLabel: string;
}

/**
 * Shared "Select market" dialog for every trading product.
 *
 * The spot terminal and the perpetual contract page each had their own picker,
 * and they drifted: different styling, different search behaviour, different
 * empty states. This component is the single implementation both pages mount,
 * so a change to the market list only happens in one place.
 */
const FAVORITES_KEY = "btcbox.market-favorites";
type PickerFilter = "all" | "volume" | "favorites" | "gainers" | "losers";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string").slice(0, 200)
      : [];
  } catch {
    return [];
  }
}

function favoriteKey(item: MarketPickerItem): string {
  return item.id.replace(/USDT$/i, "");
}

function formatQuoteVolume(value: string | number | null | undefined, locale: string): string {
  if (value === undefined || value === null || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "—";
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 2 }).format(amount);
}

export function MarketPickerDialog({ open, onOpenChange, items, activeId, onSelect, description, emptyLabel }: MarketPickerDialogProps) {
  const { t, language } = useI18n();
  const locale = localeTags[language] || "en-US";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PickerFilter>("all");
  const [favorites, setFavorites] = useState<string[]>(readFavorites);

  useEffect(() => {
    if (open) setFavorites(readFavorites());
  }, [open]);

  const toggleFavorite = (item: MarketPickerItem) => {
    const key = favoriteKey(item);
    setFavorites((current) => {
      const next = current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key].slice(-200);
      try { window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next)); } catch { /* storage may be blocked */ }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = items.filter((item) => !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q));
    if (filter === "favorites") rows = rows.filter((item) => favorites.includes(favoriteKey(item)));
    if (filter === "gainers") rows = rows.filter((item) => item.changePct != null && item.changePct > 0);
    if (filter === "losers") rows = rows.filter((item) => item.changePct != null && item.changePct < 0);
    if (filter === "volume") rows = [...rows].sort((a, b) => Number(b.quoteVolume ?? -1) - Number(a.quoteVolume ?? -1));
    return rows;
  }, [items, query, filter, favorites]);

  const filters: Array<[PickerFilter, string]> = [
    ["all", "All"],
    ["volume", "24h volume"],
    ["favorites", "Favorites"],
    ["gainers", "Gainers"],
    ["losers", "Losers"],
  ];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      onOpenChange(next);
      if (!next) { setQuery(""); setFilter("all"); }
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="term-pair-overlay" />
        <Dialog.Content className="term-pair-dialog" aria-label={t("Select market")}>
          <div className="term-pair-dialog__head">
            <Dialog.Title className="term-pair-dialog__title">{t("Select market")}</Dialog.Title>
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
            <Dialog.Close asChild>
              <button type="button" className="term-pair-dialog__close" aria-label={t("Close")}>×</button>
            </Dialog.Close>
          </div>
          <div className="term-pair-dialog__search">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search")}
              aria-label={t("Search BTCBOX")}
            />
          </div>
          <div className="term-pair-dialog__filters" role="tablist" aria-label={t("Markets")}>
            {filters.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key}
                className={filter === key ? "is-active" : ""}
                onClick={() => setFilter(key)}>{t(label)}</button>
            ))}
          </div>
          <div className="term-pair-dialog__columns" aria-hidden="true">
            <span><span>{t("Pair")}</span><small>{t("24h volume")}</small></span>
            <span data-mobile-label={`${t("Last price")} / ${t("24h change")}`}>{t("Last price")}</span>
            <span>{t("24h change")}</span>
            <span aria-hidden="true" />
          </div>
          <div className="term-pair-dialog__list">
            {filtered.length
              ? filtered.map((item) => {
                  const isActive = item.id === activeId;
                  const isFavorite = favorites.includes(favoriteKey(item));
                  return (
                    <div key={item.id} className={"term-pair-option" + (isActive ? " is-active" : "")}>
                      <button type="button" className="term-pair-option__select"
                        aria-current={isActive ? "true" : undefined}
                        onClick={() => { onSelect(item.id); onOpenChange(false); }}>
                        <span className="term-pair-option__label">
                          <TokenIcon symbol={item.label} className="h-7 w-7" />
                          <span className="term-pair-option__details">
                            <span className="term-pair-option__symbol">{item.label}</span>
                            <small className="term-pair-option__volume">{t("24h volume")} · {formatQuoteVolume(item.quoteVolume, locale)} USDT</small>
                          </span>
                        </span>
                        <span className="term-pair-option__price">{item.price ?? "—"}</span>
                        <span className={"term-pair-option__chg" + (item.changePct != null ? (item.changePct >= 0 ? " is-up" : " is-down") : "")}>
                          {item.changePct != null ? `${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(2)}%` : "—"}
                        </span>
                      </button>
                      <button type="button" className={"term-pair-option__favorite" + (isFavorite ? " is-active" : "")}
                        aria-label={t(isFavorite ? "Remove from favorites" : "Add to favorites") + " " + item.label}
                        aria-pressed={isFavorite}
                        onClick={() => toggleFavorite(item)}>
                        <Star className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  );
                })
              : <p className="term-pair-dialog__empty">{emptyLabel}</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
