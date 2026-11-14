import { cn } from "../../lib/utils";
import { useEffect, useState } from "react";

// Lazily resolve the `cryptocurrency-icons` color SVG set (nearly 500 coins).
// import.meta.glob returns a map of "path" -> dynamic import(); we resolve the
// exact color icon for a symbol at render time and fall back to the local
// monogram disc when the symbol is missing from the set.
const cryptoIconModules = import.meta.glob<string>("/node_modules/cryptocurrency-icons/svg/color/*.svg", { eager: true, import: "default" });

const iconUrlFor = (symbol: string): string | undefined => {
  const key = `/node_modules/cryptocurrency-icons/svg/color/${symbol.toLowerCase()}.svg`;
  return cryptoIconModules[key];
};

// Common quote assets stripped from a pair symbol (e.g. "BTCUSDT" / "BTC/USDT" -> "BTC")
// so a trading pair still resolves to its base-asset icon instead of plain text.
const QUOTE_ASSETS = ["USDT", "USDC", "BUSD", "USD", "BTC", "ETH", "BNB"];
const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
function resolveIconSymbol(raw: string): string | undefined {
  const normalized = normalizeSymbol(raw);
  if (!normalized) return undefined;
  if (iconUrlFor(normalized)) return normalized;
  for (const quote of QUOTE_ASSETS) {
    if (normalized.length > quote.length && normalized.endsWith(quote)) {
      const base = normalized.slice(0, normalized.length - quote.length);
      if (iconUrlFor(base)) return base;
    }
  }
  return undefined;
}
// Deterministic brand-tone fallback for symbols without a dedicated SVG:
// a tinted disc with the asset monogram keeps rows readable even when an
// icon file is missing, instead of an unmuted grey text chip.
function monogramTone(symbol: string): { background: string; color: string } {
  let hash = 0;
  for (let index = 0; index < symbol.length; index += 1) hash = (hash * 31 + symbol.charCodeAt(index)) >>> 0;
  const tones = [
    { background: "bg-brand-accent/10", color: "text-brand-accent" },
    { background: "bg-brand-cyan/10", color: "text-brand-cyan" },
    { background: "bg-brand-teal/10", color: "text-brand-teal" },
    { background: "bg-brand-violet/10", color: "text-brand-violet" },
    { background: "bg-brand-indigo/10", color: "text-brand-indigo" },
    { background: "bg-brand-surface-2", color: "text-brand-text-secondary" },
  ];
  return tones[hash % tones.length];
}
export const TokenIcon = ({ symbol, className }: { symbol: string, className?: string }) => {
  const [hasError, setHasError] = useState(false);
  const matchedSymbol = resolveIconSymbol(symbol);
  const iconUrl = matchedSymbol ? iconUrlFor(matchedSymbol) : undefined;
  useEffect(() => {
    setHasError(false);
  }, [iconUrl]);
  const showImage = Boolean(iconUrl) && !hasError;
  const tone = monogramTone(matchedSymbol || normalizeSymbol(symbol) || "?");
  return (
    <div className={cn("relative flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-border-subtle", showImage ? "bg-brand-surface-2" : cn(tone.background, "border-transparent"), className)}>
      {showImage ? (
        <img
          src={iconUrl}
          alt={symbol}
          loading="lazy"
          className="block h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className={cn("text-[10px] font-bold leading-none", tone.color)}>
          {normalizeSymbol(symbol).substring(0, 3) || "?"}
        </span>
      )}
    </div>
  );
};
