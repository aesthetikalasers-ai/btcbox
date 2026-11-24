import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
import { useI18n } from "../../lib/i18n";

/**
 * One selectable row of the market picker.
 *
 * `extra` renders the two value columns on the right (price + 24h change);
 * pages that have no ticker for a row can omit it by leaving `price` null,
 * which renders an em dash instead of a fabricated number.
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
export function MarketPickerDialog({ open, onOpenChange, items, activeId, onSelect, description, emptyLabel }: MarketPickerDialogProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setQuery(""); }}>
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
          <div className="term-pair-dialog__columns" aria-hidden="true">
            <span>{t("Trading pair")}</span>
            <span>{t("Last price")}</span>
            <span>{t("24h change")}</span>
          </div>
          <div className="term-pair-dialog__list">
            {filtered.length
              ? filtered.map((item) => {
                  const isActive = item.id === activeId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={"term-pair-option" + (isActive ? " is-active" : "")}
                      aria-current={isActive ? "true" : undefined}
                      onClick={() => { onSelect(item.id); onOpenChange(false); }}
                    >
                      <span className="term-pair-option__label">{item.label}</span>
                      <span className="term-pair-option__price">{item.price ?? "—"}</span>
                      <span className={"term-pair-option__chg" + (item.changePct != null ? (item.changePct >= 0 ? " is-up" : " is-down") : "")}>
                        {item.changePct != null ? `${item.changePct >= 0 ? "+" : ""}${item.changePct.toFixed(2)}%` : "—"}
                      </span>
                    </button>
                  );
                })
              : <p className="term-pair-dialog__empty">{emptyLabel}</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
