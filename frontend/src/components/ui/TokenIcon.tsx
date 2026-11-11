import { cn } from "../../lib/utils";
import { useEffect, useState } from "react";

const LOCAL_TOKEN_ICONS = new Set([
  "ADA", "ATOM", "AVAX", "BCH", "BNB", "BTC", "DOGE", "DOT", "ETC",
  "ETH", "LINK", "LTC", "NEAR", "SOL", "TRX", "UNI", "USDC", "USDT", "XRP",
]);

const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");

export const TokenIcon = ({ symbol, className }: { symbol: string, className?: string }) => {
  const [hasError, setHasError] = useState(false);
  const normalizedSymbol = normalizeSymbol(symbol);
  const iconUrl = LOCAL_TOKEN_ICONS.has(normalizedSymbol)
    ? `/token-icons/${normalizedSymbol.toLowerCase()}.svg`
    : undefined;

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
