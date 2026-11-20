import { ArrowLeftRight, LogIn, Minus, Plus, ShieldAlert } from "lucide-react";
import { useId, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { compareDecimalStrings, multiplyDecimalStrings } from "../../lib/decimal";
import { formatDecimalAmount, localeTags, useI18n } from "../../lib/i18n";

/** Preset stops on the balance slider, tier-1 exchange style. */
const SLIDER_STOPS = [0, 25, 50, 75, 100] as const;

const DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;

export type OrderSide = "buy" | "sell";
export type OrderType = "limit" | "market";

/** Props for {@link TerminalOrderForm}; all state stays owned by the trading page. */
export interface TerminalOrderFormProps {
  base: string;
  side: OrderSide;
  onSideChange: (side: OrderSide) => void;
  orderType: OrderType;
  onOrderTypeChange: (type: OrderType) => void;
  price: string;
  onPriceChange: (value: string) => void;
  quantity: string;
  onQuantityChange: (value: string) => void;
  availableBalance: number | string | undefined;
  availableAsset: string;
  isAuthenticated: boolean;
  /** `null` = trading policy unknown; the form then fails closed. */
  orderEntryEnabled: boolean | null;
  /** Explains why the form is disabled (engine cutover, stale snapshot, ...). */
  disabledReason: string;
  busy: boolean;
  pendingRequestId: string;
  pendingIntentInvalid: boolean;
  onSubmit: () => void;
  /** Percentage of the available balance selected by the slider (0–100). */
  sliderValue: number;
  onSliderChange: (percent: number) => void;
  /**
   * Opens the sign-in dialog in place. Signed-out visitors get the whole order
   * form as one click target, so tapping any field opens sign-in instead of
   * doing nothing (the inputs are `disabled` and cannot accept typing).
   */
  onRequestSignIn?: () => void;
}

/** Screen-reader label so icon-only steppers keep an accessible name. */
function iconButtonLabel(icon: ReactNode, label: string) {
  return (
    <>
      {icon}
      <span className="sr-only">{label}</span>
    </>
  );
}


/**
 * Desktop order entry (right column of the trading terminal).
 *
 * The submit button *is* the account gate: signed-out visitors see
 * “Login / Register to Trade” linking to /login instead of a disabled green
 * button plus an error banner. System-level policy is reduced to one inline
 * hint under the form — the page shows the dismissible banner instead.
 */
export function TerminalOrderForm(props: TerminalOrderFormProps) {
  const { t, language } = useI18n();
  const locale = localeTags[language];
  const amountId = useId();
  const sliderId = useId();

  const {
    base, side, onSideChange, orderType, onOrderTypeChange,
    price, onPriceChange, quantity, onQuantityChange,
    availableBalance, availableAsset, isAuthenticated, orderEntryEnabled,
    disabledReason, busy, pendingRequestId, pendingIntentInvalid, onSubmit,
    sliderValue, onSliderChange, onRequestSignIn,
  } = props;

  const quoteAsset = "USDT";
  const amount = price && quantity && DECIMAL_PATTERN.test(price) && DECIMAL_PATTERN.test(quantity)
    ? multiplyDecimalStrings(price, quantity)
    : "";
  const frozen = !isAuthenticated || orderEntryEnabled !== true || busy || pendingIntentInvalid;
  const totalText = amount ? formatDecimalAmount(amount, locale) + " " + quoteAsset : "—";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  const submitLabel = () => {
    if (busy) return t("Submitting…");
    if (pendingRequestId) return t("Retry same order");
    if (orderType !== "limit") return t("Market order");
    if (side === "buy") return t("Buy") + " " + base;
    return t("Sell") + " " + base;
  };

  // Preset price nudges around the current price.
  const quickPrices = [-1, -0.5, 0, 0.5, 1] as const;
  const quickPriceBase = Number(price || 0);

  /** Percentage stop writes the quantity and never bypasses submit validation. */
  const applySlider = (percent: number) => {
    onSliderChange(percent);
    const free = Number(availableBalance ?? 0);
    const px = Number(price);
    if (!Number.isFinite(free) || free <= 0) return;
    if (side === "buy") {
      if (!Number.isFinite(px) || px <= 0) return;
      const qty = (free * (percent / 100)) / px;
      onQuantityChange(qty > 0 ? Number(qty.toFixed(8)).toString() : "");
      return;
    }
    onQuantityChange(percent > 0 ? Number((free * (percent / 100)).toFixed(8)).toString() : "");
  };

  const balanceText = availableBalance === undefined ? "—" : formatDecimalAmount(availableBalance, locale);
  const balanceRequirement = side === "sell" ? quantity : amount;
  const balanceCompare = availableBalance !== undefined && balanceRequirement && DECIMAL_PATTERN.test(balanceRequirement)
    ? compareDecimalStrings(String(availableBalance), balanceRequirement)
    : undefined;
  const insufficient = balanceCompare !== undefined && balanceCompare < 0;

  const quickPriceDecimals = Math.min(8, Math.max(2, (price.split(".")[1] || "").length));
  const stepPrice = 10 ** -quickPriceDecimals;

  /**
   * Steppers only nudge the displayed string by one unit of its own precision:
   * the authoritative precision and minimum-order limits are still enforced by
   * the submit validation on the page.
   */
  const applyPriceStep = (direction: number) => {
    const current = Number(price || 0);
    if (!Number.isFinite(current)) return;
    const next = Math.max(0, current + direction * stepPrice);
    onPriceChange(next > 0 ? next.toFixed(quickPriceDecimals) : "");
  };
  const applyQuantityStep = (direction: number) => {
    const decimals = Math.min(8, (quantity.split(".")[1] || "").length);
    const current = Number(quantity || "0");
    if (!Number.isFinite(current)) return;
    const next = Math.max(0, current + direction * 10 ** -decimals);
    onQuantityChange(next > 0 ? next.toFixed(decimals) : "");
  };

  return (
    <form
      className={"term-form" + (isAuthenticated ? "" : " term-form--locked")}
      onSubmit={submit}
      aria-label={t("Order form")}
    >
      {/* Signed-out: every input is `disabled`, and disabled controls swallow
          click events, so the form-level onClick below never fires from them.
          This overlay is the click target that opens sign-in; it sits under the
          CTA (which keeps its own handler) and is absent once signed in. */}
      {isAuthenticated ? null : (
        <button
          type="button"
          className="term-form-gate"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => onRequestSignIn?.()}
        />
      )}
      <div className="term-side-tabs" role="tablist" aria-label={t("Order side")}>
        <button
          type="button"
          role="tab"
          aria-selected={side === "buy"}
          aria-pressed={side === "buy"}
          className={side === "buy" ? "is-buy" : ""}
          disabled={busy || !!pendingRequestId || pendingIntentInvalid}
          onClick={() => onSideChange("buy")}
        >
          {t("Buy")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={side === "sell"}
          aria-pressed={side === "sell"}
          className={side === "sell" ? "is-sell" : ""}
          disabled={busy || !!pendingRequestId}
          onClick={() => onSideChange("sell")}
        >
          {t("Sell")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          aria-pressed={orderType === "limit"}
          className={"term-type-tab " + (orderType === "limit" ? "is-active" : "")}
          disabled={busy || !!pendingRequestId}
          onClick={() => onOrderTypeChange("limit")}
        >
          {t("Limit order")}
        </button>
        <button
          type="button"
          aria-pressed={orderType === "market"}
          className={"term-type-tab " + (orderType === "market" ? "is-active" : "")}
          disabled={busy || !!pendingRequestId}
          onClick={() => onOrderTypeChange("market")}
        >
          {t("Market order")}
        </button>
      </div>
      <select
        aria-label={t("Order type")}
        className="term-type-select"
        value={orderType}
        disabled={busy || !!pendingRequestId}
        onChange={(event) => onOrderTypeChange(event.target.value as OrderType)}
      >
        <option value="limit">{t("Limit order")}</option>
        <option value="market">{t("Market order")}</option>
      </select>
      {orderType === "market" ? (
        <p className="spot-policy">{t("Market orders are unavailable under the current trading contract. Switch to limit order to continue.")}</p>
      ) : null}

      <div className="term-balance">
        <div className="min-w-0">
          <span className="term-balance-label">{t("Available balance")}</span>
          <p className="term-balance-value" title={balanceText + " " + availableAsset}>
            {balanceText} <span className="text-brand-text-muted">{availableAsset}</span>
          </p>
        </div>
        <div className="term-balance-actions">
          <Link to={isAuthenticated ? "/deposit" : "/login"} className="term-balance-icon" aria-label={t("Deposit")} title={t("Deposit")}>
            <Plus className="h-3.5 w-3.5" />
          </Link>
          <Link to={isAuthenticated ? "/assets" : "/login"} className="term-balance-icon" aria-label={t("Transfer")} title={t("Transfer")}>
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Price: label row carries the stepper so the input stays full width. */}
      <div className="term-field">
        <div className="term-field-label">
          <label htmlFor={amountId + "-price"}>{t("Limit price (USDT)")}</label>
          <span className="term-stepper">
            <button type="button" aria-label={t("Decrease price")} disabled={frozen} onClick={() => applyPriceStep(-1)}>
              {iconButtonLabel(<Minus className="h-3 w-3" />, t("Decrease price"))}
            </button>
            <button type="button" aria-label={t("Increase price")} disabled={frozen} onClick={() => applyPriceStep(1)}>
              {iconButtonLabel(<Plus className="h-3 w-3" />, t("Increase price"))}
            </button>
          </span>
        </div>
        <div className="term-input-wrap">
          <input
            id={amountId + "-price"}
            aria-label={t("Limit price (USDT)")}
            value={price}
            onChange={(event) => onPriceChange(event.target.value)}
            disabled={frozen}
            inputMode="decimal"
            autoComplete="off"
            className="term-input"
            required
          />
          <span className="term-input-suffix">USDT</span>
        </div>
      </div>

      <div className="term-quick-prices">
        {quickPrices.map((pct) => {
          const target = quickPriceBase * (1 + pct / 100);
          const enabled = !frozen && quickPriceBase > 0;
          return (
            <button
              key={pct}
              type="button"
              disabled={frozen || quickPriceBase <= 0}
              aria-label={pct === 0 ? t("Current price") : (pct > 0 ? "+" : "") + pct + "%"}
              onClick={() => enabled && onPriceChange(Number(target.toFixed(quickPriceDecimals)).toString())}
            >
              {pct === 0 ? t("Last") : (pct > 0 ? "+" : "") + pct + "%"}
            </button>
          );
        })}
      </div>

      <div className="term-field">
        <div className="term-field-label">
          <label htmlFor={amountId + "-qty"}>{t("Amount")}</label>
          <span className="term-stepper">
            <button type="button" aria-label={t("Decrease quantity")} disabled={frozen} onClick={() => applyQuantityStep(-1)}>
              {iconButtonLabel(<Minus className="h-3 w-3" />, t("Decrease quantity"))}
            </button>
            <button type="button" aria-label={t("Increase quantity")} disabled={frozen} onClick={() => applyQuantityStep(1)}>
              {iconButtonLabel(<Plus className="h-3 w-3" />, t("Increase quantity"))}
            </button>
          </span>
        </div>
        <div className="term-input-wrap">
          <input
            id={amountId + "-qty"}
            aria-label={t("Quantity") + " · " + base}
            value={quantity}
            onChange={(event) => onQuantityChange(event.target.value)}
            disabled={frozen}
            inputMode="decimal"
            autoComplete="off"
            className="term-input"
            required
          />
          <span className="term-input-suffix">{base}</span>
        </div>
      </div>

      <div className="term-slider">
        <input
          id={sliderId}
          type="range"
          min={0}
          max={100}
          step={1}
          value={sliderValue}
          aria-label={t("Order size percentage")}
          disabled={frozen || availableBalance === undefined}
          onChange={(event) => applySlider(Number(event.target.value))}
          style={{ ["--slider-fill" as string]: sliderValue + "%" }}
        />
        <div className="term-slider-stops" role="group" aria-label={t("Order size percentage")}>
          {SLIDER_STOPS.map((stop) => (
            <button
              key={stop}
              type="button"
              aria-pressed={sliderValue === stop}
              disabled={frozen}
              onClick={() => applySlider(stop)}
            >
              {stop}%
            </button>
          ))}
        </div>
      </div>

      <div className="term-total">
        <span>{t("Estimated total")}</span>
        <strong className="font-mono tabular-nums">{totalText}</strong>
      </div>

      {pendingRequestId ? (
        <p className="break-all text-[11px] text-brand-warning">
          {t("Unconfirmed request ID. Keep the form unchanged and retry with the same ID.")} · {pendingRequestId}
        </p>
      ) : null}

      {isAuthenticated ? (
        <>
          <Button
            className={"term-submit " + (side === "buy" ? "term-submit--buy" : "term-submit--sell")}
            type="submit"
            disabled={frozen || insufficient || orderType !== "limit" || !price || !quantity}
          >
            {insufficient ? t("Insufficient available balance") : submitLabel()}
          </Button>
          {disabledReason ? <p className="spot-policy">{disabledReason}</p> : null}
        </>
      ) : (
        <div className="term-signin-card" onClick={() => onRequestSignIn?.()}>
          {/* Signed-out: instead of a lone green button floating among greyed-out
              fields, the panel gets one explicit glass card. It states what is
              unavailable and why, so the dimmed inputs read as "locked" rather
              than "broken". */}
          <span className="term-signin-card__icon" aria-hidden="true"><LogIn className="h-4 w-4" /></span>
          <p className="term-signin-card__title">{t("Sign in to trade")}</p>
          <p className="term-signin-card__hint">{t("Market data stays fully available without an account.")}</p>
          <button
            type="button"
            className="term-submit term-submit--brand"
            aria-label={t("Login / Register to Trade")}
            onClick={() => onRequestSignIn?.()}
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            {t("Login / Register to Trade")}
          </button>
        </div>
      )}

      {!isAuthenticated ? (
        <p className="term-form-note">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("Sign in to place orders. Market data stays fully available without an account.")}</span>
        </p>
      ) : null}
    </form>
  );
}
