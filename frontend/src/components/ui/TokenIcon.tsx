import { cn } from "../../lib/utils";
import { useEffect, useState } from "react";

const LOCAL_TOKEN_ICONS = new Set([
  "ADA", "ATOM", "AVAX", "BCH", "BNB", "BTC", "DOGE", "DOT", "ETC",
  "ETH", "LINK", "LTC", "NEAR", "SOL", "TRX", "UNI", "USDC", "USDT", "XRP",
]);

// Common quote assets stripped from a pair symbol (e.g. "BTCUSDT" / "BTC/USDT" -> "BTC")
// so a trading pair still resolves to its base-asset icon instead of plain text.
const QUOTE_ASSETS = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "BNB"];

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

function resolveIconSymbol(raw: string): string | undefined {
  const normalized = normalizeSymbol(raw);
  if (!normalized) return undefined;
  if (LOCAL_TOKEN_ICONS.has(normalized)) return normalized;
  for (const quote of QUOTE_ASSETS) {
    if (normalized.length > quote.length && normalized.endsWith(quote)) {
      const base = normalized.slice(0, normalized.length - quote.length);
      if (LOCAL_TOKEN_ICONS.has(base)) return base;
    }
  }
  return undefined;
}

export const TokenIcon = ({ symbol, className }: { symbol: string, className?: string }) => {
  const [hasError, setHasError] = useState(false);
  const matchedSymbol = resolveIconSymbol(symbol);
  const iconUrl = matchedSymbol ? `/token-icons/${matchedSymbol.toLowerCase()}.svg` : undefined;

  useEffect(() => {
    setHasError(false);
  }, [iconUrl]);

  return (
    <div className={cn("relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border-subtle bg-brand-surface-2", className)}>
      {!iconUrl || hasError ? (
        <span className="text-[10px] font-bold text-brand-text-secondary leading-none">
          {symbol.substring(0, 3)}
        </span>
      ) : (
        <img
          src={iconUrl}
          alt={symbol}
          className="block h-full w-full object-contain"
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};
