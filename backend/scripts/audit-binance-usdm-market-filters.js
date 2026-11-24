'use strict';

// Read-only reference audit of Binance USDⓈ-M perpetual filters.
// This script never writes BTCBOX configuration or enables a market.
const ENDPOINT = 'https://fapi.binance.com/fapi/v1/exchangeInfo';
const CANDIDATE_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','DOGEUSDT',
  'ADAUSDT','AVAXUSDT','LINKUSDT','DOTUSDT','TRXUSDT','LTCUSDT',
  'BCHUSDT','NEARUSDT','UNIUSDT','ATOMUSDT','ETCUSDT','APTUSDT',
  'ARBUSDT','OPUSDT','SUIUSDT','INJUSDT','TIAUSDT','FILUSDT'
];

function positive(value) {
  if (value === null || value === undefined || value === '') return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}
function filterByType(filters, type) {
  return Array.isArray(filters) ? filters.find(item => item && item.filterType === type) || null : null;
}
function extractUsdmMarketFilters(payload, symbols = CANDIDATE_SYMBOLS) {
  if (!payload || !Array.isArray(payload.symbols)) throw new Error('Binance exchangeInfo response has no symbols array');
  const bySymbol = new Map(payload.symbols.map(item => [String(item && item.symbol || '').toUpperCase(), item]));
  const markets = [];
  const unsupported = [];
  const invalid = [];
  for (const symbol of symbols) {
    const row = bySymbol.get(symbol);
    if (!row || row.contractType !== 'PERPETUAL' || row.quoteAsset !== 'USDT' || row.status !== 'TRADING') {
      unsupported.push({ symbol, reason: !row ? 'not_listed' : 'not_trading_usdt_perpetual', observed_status: row && row.status || null });
      continue;
    }
    const price = filterByType(row.filters, 'PRICE_FILTER');
    const lot = filterByType(row.filters, 'LOT_SIZE');
    const marketLot = filterByType(row.filters, 'MARKET_LOT_SIZE');
    const notional = filterByType(row.filters, 'MIN_NOTIONAL') || filterByType(row.filters, 'NOTIONAL');
    const item = {
      symbol,
      contract_type: row.contractType,
      status: row.status,
      base_asset: row.baseAsset,
      quote_asset: row.quoteAsset,
      price_tick: price && price.tickSize || null,
      min_price: price && price.minPrice || null,
      max_price: price && price.maxPrice || null,
      quantity_step: lot && lot.stepSize || null,
      min_quantity: lot && lot.minQty || null,
      max_quantity: lot && lot.maxQty || null,
      market_quantity_step: marketLot && marketLot.stepSize || null,
      market_min_quantity: marketLot && marketLot.minQty || null,
      market_max_quantity: marketLot && marketLot.maxQty || null,
      min_notional: notional && (notional.notional || notional.minNotional) || null,
      notional_filter_type: notional && notional.filterType || null,
      maint_margin_percent: row.maintMarginPercent || null,
      required_margin_percent: row.requiredMarginPercent || null,
      liquidation_fee: row.liquidationFee || null,
      market_take_bound: row.marketTakeBound || null,
      price_precision_reference_only: row.pricePrecision ?? null,
      quantity_precision_reference_only: row.quantityPrecision ?? null,
    };
    const missing = ['price_tick','quantity_step','min_quantity','market_quantity_step','market_min_quantity','min_notional'].filter(key => !positive(item[key]));
    if (missing.length) invalid.push({ symbol, missing });
    markets.push(item);
  }
  return {
    source: ENDPOINT,
    server_time: payload.serverTime || null,
    generated_at: new Date().toISOString(),
    candidate_count: symbols.length,
    listed_trading_count: markets.length,
    unsupported,
    invalid,
    markets,
  };
}
async function main() {
  const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (response.status === 451) {
    process.stdout.write(JSON.stringify({
      source: ENDPOINT, data_status: 'blocked_by_provider', http_status: 451,
      generated_at: new Date().toISOString(), candidate_count: CANDIDATE_SYMBOLS.length,
      markets: [], unsupported: CANDIDATE_SYMBOLS.map(symbol => ({ symbol, reason: 'provider_access_blocked' })),
      invalid: [],
    }, null, 2) + '\n');
    return;
  }
  if (!response.ok) throw new Error('Binance exchangeInfo HTTP ' + response.status);
  const payload = await response.json();
  const report = extractUsdmMarketFilters(payload);
  report.data_status = 'available';
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (report.invalid.length) process.exitCode = 2;
}
if (require.main === module) {
  main().catch(error => { console.error('[perp-filter-audit] failed:', error.message); process.exitCode = 1; });
}
module.exports = { CANDIDATE_SYMBOLS, extractUsdmMarketFilters };
