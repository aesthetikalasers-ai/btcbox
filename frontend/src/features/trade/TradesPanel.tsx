import { useMemo } from "react";
import { Radio } from "lucide-react";
import { useI18n, localeTags } from "../../lib/i18n";
import { useMarketStreamEvent, type StreamState } from "../../lib/useMarketStreamEvent";

interface Trade {
  price: string;
  size: string;
  side: "buy" | "sell";
  ts: number;
}

/** Validates one `trades` update frame; malformed rows are dropped, not rendered. */
function parseTrades(payload: unknown): Trade[] | null {
  const body = payload as { ok?: boolean; trades?: unknown } | null;
  if (!body || body.ok !== true || !Array.isArray(body.trades)) return null;
  const rows = body.trades
    .filter((row): row is Trade => {
      const t = row as Trade;
      return !!t && Number.isFinite(Number(t.price)) && Number(t.price) > 0
        && Number.isFinite(Number(t.size)) && Number(t.size) > 0
        && (t.side === "buy" || t.side === "sell");
    })
    .slice(0, 30);
  return rows.length ? rows : null;
}

const STATE_DOT: Record<StreamState, string> = {
  idle: "bg-brand-text-disabled",
  connecting: "bg-brand-text-disabled",
  live: "bg-brand-accent",
  degraded: "bg-brand-danger",
  closed: "bg-brand-text-disabled",
};

/**
 * Recent trades tape.
 *
 * Streamed over SSE. When the stream is degraded the panel says so and shows
 * the last known tape rather than clearing it — a trader reading the tape needs
 * to know whether what they see is current.
 */
export function TradesPanel({ symbol, limit = 30 }: { symbol: string; limit?: number }) {
  const { t, language } = useI18n();
  const locale = localeTags[language] || "en-US";
  const { data, state, errorCode } = useMarketStreamEvent<Trade[]>({
    channel: "trades",
    symbol,
    parse: parseTrades,
  });

  const rows = useMemo(() => (data ?? []).slice(0, limit), [data, limit]);

  const fmtPrice = (value: string) =>
    Number(value).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: Number(value) >= 1 ? 2 : 8 });
  const fmtSize = (value: string) =>
    Number(value).toLocaleString(locale, { maximumFractionDigits: 4 });
  const fmtTime = (ts: number) =>
    new Date(ts).toLocaleTimeString(locale, { hour12: false });

  const stateLabel =
    state === "live" ? t("Live") :
    state === "connecting" ? t("Connecting") :
    state === "degraded" ? t("Degraded") : t("Idle");

  return (
    <div className="overflow-hidden rounded-md border border-brand-border bg-brand-surface">
      <div className="flex items-center justify-between gap-2 border-b border-brand-border px-3 py-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 shrink-0 text-brand-text-muted" />
          <span className="truncate text-[12px] font-semibold text-brand-text">{t("Recent trades")}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-medium text-brand-text-muted">
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} />
          {stateLabel}
        </span>
      </div>

      {rows.length === 0 ? (
        <div className="px-3 py-8 text-center">
          <p className="text-[11.5px] text-brand-text-muted">
            {state === "degraded" ? t("Recent trades are temporarily unavailable.") : t("Waiting for trades…")}
          </p>
        </div>
      ) : (
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="border-b border-brand-border text-[10px] text-brand-text-muted">
              <th scope="col" className="px-3 py-1.5 text-left font-medium">{t("Price")}</th>
              <th scope="col" className="w-[34%] px-2 py-1.5 text-right font-medium">{t("Size")}</th>
              <th scope="col" className="w-[30%] px-3 py-1.5 text-right font-medium">{t("Time")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((trade, index) => (
              <tr key={`${trade.ts}-${index}`} className="border-b border-brand-border/40 last:border-b-0">
                <td className={`px-3 py-1 font-mono text-[11.5px] tabular-nums ${trade.side === "buy" ? "text-brand-accent" : "text-brand-danger"}`}>
                  {fmtPrice(trade.price)}
                </td>
                <td className="px-2 py-1 text-right font-mono text-[11.5px] tabular-nums text-brand-text-secondary">
                  {fmtSize(trade.size)}
                </td>
                <td className="px-3 py-1 text-right font-mono text-[10.5px] tabular-nums text-brand-text-muted">
                  {fmtTime(trade.ts)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {state === "degraded" && errorCode ? (
        <p className="border-t border-brand-border px-3 py-1.5 text-[10px] text-brand-text-muted" role="status">
          {t("Stream interrupted. Showing the last known trades.")} ({errorCode})
        </p>
      ) : null}
    </div>
  );
}
