import { TokenIcon } from "../../../components/ui/TokenIcon";
import { Card } from "./Card";
import type { MarketTicker } from "../../../lib/api";

const names: Record<string, string> = {
  BTC: "Bitcoin", ETH: "Ethereum", SOL: "Solana", BNB: "BNB",
  XRP: "XRP", DOGE: "Dogecoin", ADA: "Cardano", AVAX: "Avalanche",
  LINK: "Chainlink", DOT: "Polkadot", TRX: "TRON", LTC: "Litecoin",
  BCH: "Bitcoin Cash", NEAR: "NEAR Protocol", UNI: "Uniswap",
  ATOM: "Cosmos", ETC: "Ethereum Classic",
};

const price = (value: number) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: value >= 1 ? 4 : 8,
}).format(value);

export function LiveMarketsTable({ markets, loading, error }: {
  markets: MarketTicker[];
  loading: boolean;
  error: string;
}) {
  return (
    <Card className="flex flex-col overflow-hidden px-0 py-0">
      <div className="flex items-center justify-between gap-3 border-b border-brand-border px-4 py-4 md:px-6">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-brand-text">Spot markets</h2>
          <p className="mt-1 text-xs text-brand-text-muted">Live prices from the BTCBOX market service</p>
        </div>
        <span className="shrink-0 rounded-lg border border-brand-border-subtle bg-[#121316] px-3 py-2 text-xs text-brand-text-secondary">
          {loading ? "Loading…" : `${markets.length} pairs`}
        </span>
      </div>
      {error ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-brand-text">Market feed unavailable</p>
          <p className="mt-2 text-sm text-brand-text-muted">{error}</p>
        </div>
      ) : loading && markets.length === 0 ? (
        <div className="space-y-3 px-5 py-8" aria-label="Loading markets">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />)}
        </div>
      ) : markets.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-brand-text-muted">No market pairs are currently available.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-left">
            <thead><tr className="border-b border-brand-border bg-[#101113]">
              {["Asset", "Last price", "24h change", "24h volume", "24h high", "24h low"].map((label) =>
                <th key={label} className="whitespace-nowrap px-4 py-3 text-xs font-medium text-brand-text-muted md:px-6">{label}</th>
              )}
            </tr></thead>
            <tbody>{markets.map((item) => (
              <tr key={item.sym} className="border-b border-brand-border/50 transition-colors hover:bg-brand-surface-hover">
                <td className="h-16 whitespace-nowrap px-4 py-2 md:px-6">
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={item.sym} className="h-8 w-8" />
                    <div><p className="text-sm font-medium text-brand-text">{names[item.sym] || item.sym}</p><p className="text-[11px] text-brand-text-muted">{item.sym}/USDT</p></div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 text-sm font-medium tabular-nums text-brand-text md:px-6">{price(item.price)}</td>
                <td className={`whitespace-nowrap px-4 text-sm font-medium tabular-nums md:px-6 ${item.chg >= 0 ? "text-profit" : "text-loss"}`}>{item.chg > 0 ? "+" : ""}{item.chg.toFixed(2)}%</td>
                <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{item.vol} USDT</td>
                <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{price(item.high)}</td>
                <td className="whitespace-nowrap px-4 text-sm tabular-nums text-brand-text-secondary md:px-6">{price(item.low)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
