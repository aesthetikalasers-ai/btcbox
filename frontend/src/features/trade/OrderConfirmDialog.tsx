import * as Dialog from "@radix-ui/react-dialog";
import { TriangleAlert, X } from "lucide-react";
import { useI18n } from "../../lib/i18n";

export interface OrderPreview {
  pair: string;
  side: "buy" | "sell";
  price: string;
  quantity: string;
  /** quote notional = price * quantity */
  notional: number;
  /** current market price used for the deviation check */
  marketPrice: number | null;
  /** absolute % difference between the limit price and the market price */
  deviationPct: number | null;
}

/**
 * Pre-trade confirmation.
 *
 * Shown only when an order is large enough or priced far enough from the market
 * that a mis-click would be expensive. The dialog restates the numbers the
 * server will receive, so the user confirms the actual payload rather than a
 * summary that could drift from it.
 */
export function OrderConfirmDialog({ open, preview, busy, onCancel, onConfirm }: {
  open: boolean;
  preview: OrderPreview | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  if (!preview) return null;

  const isBuy = preview.side === "buy";
  const tone = isBuy ? "text-brand-accent" : "text-brand-danger";
  const bigDeviation = preview.deviationPct !== null && preview.deviationPct >= 5;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-[71] mx-auto w-full max-w-md rounded-t-2xl border border-brand-border bg-brand-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-overlay">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Dialog.Title className="text-[15px] font-semibold text-brand-text">{t("Confirm order")}</Dialog.Title>
              <Dialog.Description className="mt-0.5 text-[11.5px] text-brand-text-muted">
                {t("Check the details before sending this order.")}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label={t("Cancel")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-brand-border text-brand-text-muted transition-colors hover:text-brand-text">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="overflow-hidden rounded-md border border-brand-border bg-brand-surface-2">
            <div className="flex items-baseline justify-between gap-3 border-b border-brand-border/60 px-3 py-2.5">
              <span className="text-[11.5px] text-brand-text-muted">{t("Pair")}</span>
              <span className="text-[12.5px] font-semibold text-brand-text">{preview.pair}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-brand-border/60 px-3 py-2.5">
              <span className="text-[11.5px] text-brand-text-muted">{t("Side")}</span>
              <span className={`text-[12.5px] font-semibold ${tone}`}>{isBuy ? t("Buy") : t("Sell")}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-brand-border/60 px-3 py-2.5">
              <span className="text-[11.5px] text-brand-text-muted">{t("Limit price")}</span>
              <span className="font-mono text-[12.5px] tabular-nums text-brand-text">{preview.price}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-b border-brand-border/60 px-3 py-2.5">
              <span className="text-[11.5px] text-brand-text-muted">{t("Quantity")}</span>
              <span className="font-mono text-[12.5px] tabular-nums text-brand-text">{preview.quantity}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 px-3 py-2.5">
              <span className="text-[11.5px] text-brand-text-muted">{t("Order value")}</span>
              <span className="font-mono text-[12.5px] font-semibold tabular-nums text-brand-text">
                {preview.notional.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
              </span>
            </div>
          </div>

          {preview.deviationPct !== null && preview.deviationPct > 0 ? (
            <div className={`mt-3 flex items-start gap-2 rounded-md border px-3 py-2.5 ${
              bigDeviation ? "border-brand-danger/30 bg-brand-danger/[0.06]" : "border-brand-border bg-brand-surface-2"
            }`}>
              <TriangleAlert className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${bigDeviation ? "text-brand-danger" : "text-brand-text-muted"}`} />
              <p className={`text-[11.5px] leading-relaxed ${bigDeviation ? "text-brand-text-secondary" : "text-brand-text-muted"}`}>
                {t("Your limit price is")} {preview.deviationPct.toFixed(2)}%{" "}
                {preview.marketPrice !== null && Number(preview.price) > preview.marketPrice ? t("above") : t("below")}{" "}
                {t("the current market price")} ({preview.marketPrice}).
                {bigDeviation ? ` ${t("This order may fill far from the market price.")}` : ""}
              </p>
            </div>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="h-11 rounded-md border border-brand-border text-[12.5px] font-semibold text-brand-text-muted transition-colors hover:text-brand-text"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`h-11 rounded-md text-[12.5px] font-bold transition-opacity disabled:opacity-50 ${
                isBuy ? "bg-brand-accent text-[#05201A]" : "bg-brand-danger text-white"
              }`}
            >
              {busy ? t("Placing…") : isBuy ? t("Confirm buy") : t("Confirm sell")}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

