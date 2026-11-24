import type { MarketTicker, PublicAssetConfig } from "./api";

const QUOTE_ASSET = "USDT";

/** Extract the base asset from backend tickers and common pair spellings. */
export function baseAssetCode(symbol: string): string {
  const normalized = String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return normalized.endsWith(QUOTE_ASSET)
    ? normalized.slice(0, -QUOTE_ASSET.length)
    : normalized;
}

/**
 * Apply the public asset catalogue to every spot ticker surface.
 * A missing catalogue is deliberately fail-closed: an API failure must never
 * turn into permission to display a stale or cached market row.
 */
export function filterPublicSpotMarkets(
  markets: MarketTicker[],
  assets: PublicAssetConfig[] | null,
): MarketTicker[] {
  if (!assets) return [];
  const byCode = new Map(assets.map((asset) => [asset.code, asset] as const));
  const quote = byCode.get(QUOTE_ASSET);
  if (!quote || !quote.enabled || !quote.visible || !quote.spot_enabled) return [];
  return markets.filter((market) => {
    const base = byCode.get(baseAssetCode(market.sym));
    return !!base && base.enabled && base.visible && base.spot_enabled;
  });
}

export function publicAssetName(
  assets: PublicAssetConfig[] | null,
  symbol: string,
): string | undefined {
  if (!assets) return undefined;
  const asset = assets.find((item) => item.code === baseAssetCode(symbol));
  return asset ? asset.display_name || asset.name : undefined;
}
