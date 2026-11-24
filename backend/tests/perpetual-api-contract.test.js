'use strict';
// Perpetual (Contract / Perpetual) v1 — API-layer contract tests (source-level, no DB).
// Verifies: feature switch default-off, input validation, idempotency keys, money-as-strings,
// no JS Number settlement, admin endpoints gated by permission, no fake availability.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = fs.readFileSync(path.join(root, 'api-core.js'), 'utf8');

function routeSlice(startMarker, endMarker) {
  const start = api.indexOf(startMarker);
  const end = api.indexOf(endMarker, start + 1);
  assert.ok(start >= 0, 'missing start: ' + startMarker);
  assert.ok(end > start, 'missing end: ' + endMarker);
  return api.slice(start, end);
}

test('perpetual engine feature switch defaults OFF and gates every write', () => {
  assert.ok(api.includes('function perpetualEngineEnabled()'));
  assert.ok(api.includes("process.env.FINANCIAL_PERPETUAL_ENGINE_ENABLED === '1'"));
  assert.ok(api.includes("process.env.FINANCIAL_PERPETUAL_WORKERS_READY === '1'"));
  assert.ok(api.includes('mark-price, funding and liquidation workers are deployed and monitored'));
  assert.ok(api.includes('&& financialWritesEnabled()'));
  // writes must check perpetualEngineEnabled() BEFORE calling perpRpc
  assert.ok(api.includes("if (!perpetualEngineEnabled()) return json({ ok: false, code: 'PERPETUAL_ENGINE_UNAVAILABLE'"));
  assert.ok(api.includes('Perpetual trading is not enabled. No order was created and your balance was unchanged.'));
  // perpRpc itself also fails closed
  assert.ok(api.includes('async function perpRpc(name, payload)'));
  assert.ok(api.includes("error.code = 'PERPETUAL_ENGINE_UNAVAILABLE'"));
});

test('perpetual public markets never fake availability — returns empty list when disabled', () => {
  const route = routeSlice("path === 'perpetual/markets' && method === 'GET'", "path === 'perpetual/order' && method === 'POST'");
  assert.ok(route.includes('perpetual_enabled: false'));
  assert.ok(route.includes('markets: []'));
  assert.ok(route.includes('Perpetual trading is not enabled yet.'));
  // reads enabled markets only (enabled=eq.true)
  assert.ok(route.includes('enabled=eq.true'));
});

test('perpetual order submission validates all inputs before RPC and requires idempotency key', () => {
  const route = routeSlice("path === 'perpetual/order' && method === 'POST'", "path === 'perpetual/order' && method === 'DELETE'");
  assert.ok(route.includes('ACCOUNT_FROZEN'));
  assert.ok(route.includes('INVALID_SYMBOL'));
  assert.ok(route.includes("['limit','market']"));
  assert.ok(route.includes('INVALID_LEVERAGE'));
  assert.ok(route.includes('leverage > 100'));
  assert.ok(route.includes('IDEMPOTENCY_KEY_REQUIRED'));
  assert.ok(route.includes('x-idempotency-key')); // accepts header or body
  assert.ok(route.includes('client_order_id'));
  // money passed as strings: parseMoneyInput, never Number() on qty/price
  assert.ok(route.includes('parseMoneyInput(body.quantity)'));
  assert.ok(!route.includes('Number(body.quantity)'));
  assert.ok(!route.includes('Number(body.price)'));
  // RPC call with string params
  assert.ok(route.includes("perpRpc('perp_submit_order'"));
  assert.ok(route.includes('p_price: price, p_quantity: quantity')); // strings passed through
  // rate limit consumed before RPC
  assert.ok(route.includes("rateCheckShared('spot_order'"));
});

test('perpetual cancel requires client_cancel_id and calls perp_cancel_order', () => {
  const route = routeSlice("path === 'perpetual/order' && method === 'DELETE'", "path === 'perpetual/close-position' && method === 'POST'");
  assert.ok(route.includes('client_cancel_id'));
  assert.ok(route.includes("perpRpc('perp_cancel_order'"));
  assert.ok(route.includes("rateCheckShared('spot_cancel'"));
  assert.ok(route.includes('Cancel was not executed.'));
});

test('perpetual close-position is reduce-only market order and rejects when no position', () => {
  const route = routeSlice("path === 'perpetual/close-position' && method === 'POST'", "path === 'perpetual/orders' && method === 'GET'");
  assert.ok(route.includes('NO_POSITION'));
  assert.ok(route.includes('p_reduce_only: true, p_close_position: true'));
  assert.ok(route.includes("p_type: 'market'"));
  // closes opposite side: long→sell, short→buy
  assert.ok(route.includes("pos.side === 'long' ? 'sell' : 'buy'"));
});

test('perpetual positions read computes unrealized PnL display-only and marks estimates as non-authoritative', () => {
  const route = routeSlice("path === 'perpetual/positions' && method === 'GET'", "path === 'perpetual/trades' && method === 'GET'");
  assert.ok(route.includes('perp_latest_mark_price'));
  assert.ok(route.includes('unrealized_pnl_est'));
  assert.ok(route.includes('display-only estimates; settlement & liquidation are database-authoritative'));
});

test('perpetual trades & funding reads exist and are auth-gated', () => {
  assert.ok(api.includes("path === 'perpetual/trades' && method === 'GET'"));
  assert.ok(api.includes("path === 'perpetual/funding' && method === 'GET'"));
  assert.ok(api.includes("path === 'perpetual/orders' && method === 'GET'"));
});

test('admin perpetual market upsert validates max_leverage <= 100 and mmr range, gated by system_config.write', () => {
  const start = api.indexOf("perpSub === 'market' && method === 'POST'");
  assert.ok(start >= 0, 'admin perpetual market upsert route missing');
  const route = api.slice(start, start + 4000);
  assert.ok(route.includes("hasAdminPermission(adminMembership, 'system_config.write')"));
  assert.ok(route.includes('maxLeverage > 100'));
  assert.ok(route.includes('mmr < 0 || mmr > 0.5'));
  assert.ok(route.includes('INVALID_MARKET_CONFIG'));
  assert.ok(route.includes("symbol !== baseAsset + 'USDT'"));
  assert.ok(route.includes('perpetual_markets?on_conflict=symbol'));
});

test('admin perpetual liquidations & insurance endpoints gated by financial_audit.read', () => {
  assert.ok(api.includes("perpSub === 'liquidations' && method === 'GET'"));
  assert.ok(api.includes("perpSub === 'insurance' && method === 'GET'"));
  const liqStart = api.indexOf("perpSub === 'liquidations'");
  const liqRoute = api.slice(liqStart, liqStart + 600);
  assert.ok(liqRoute.includes("'financial_audit.read'"));
  assert.ok(liqRoute.includes('perpetual_liquidation_events'));
  const insStart = api.indexOf("perpSub === 'insurance'");
  const insRoute = api.slice(insStart, insStart + 600);
  assert.ok(insRoute.includes('__perp_insurance__'));
});

test('workers exist and are idempotent/restart-safe', () => {
  for (const f of ['perp-mark-price-worker.js', 'perp-funding-worker.js', 'perp-liquidation-worker.js']) {
    const src = fs.readFileSync(path.join(root, 'scripts', f), 'utf8');
    assert.ok(src.includes('SUPABASE_SERVICE_ROLE_KEY'), f + ' must require service key');
    assert.ok(src.includes('perp_record_mark_price') || src.includes('perp_settle_funding_one') || src.includes('perp_liquidate_position'), f + ' must call a perp RPC');
  }
  const mark = fs.readFileSync(path.join(root, 'scripts', 'perp-mark-price-worker.js'), 'utf8');
  assert.ok(mark.includes('sources.length < 2'), 'mark worker requires >=2 sources');
  assert.ok(mark.includes('CIRCUIT BREAKER'), 'mark worker reports circuit breaker');
  assert.ok(mark.includes('perpetual_markets?select=symbol,base_asset,quote_asset,mark_price_stale_sec,circuit_breaker_deviation_pct&enabled=eq.true'),
    'mark worker discovers all enabled markets from the database');
  assert.ok(mark.includes('PERP_COINGECKO_IDS'), 'additional symbols require an explicit provider mapping');
  assert.ok(mark.includes('market.mark_price_stale_sec'), 'mark worker uses the market-specific stale threshold');
  assert.ok(mark.includes('market.circuit_breaker_deviation_pct'), 'mark worker uses the market-specific circuit breaker');
  assert.ok(mark.includes('ADAUSDT') && mark.includes('AVAXUSDT') && mark.includes('DOGEUSDT') && mark.includes('XRPUSDT'),
    'registered BTCBOX assets have built-in provider mappings');
  const fund = fs.readFileSync(path.join(root, 'scripts', 'perp-funding-worker.js'), 'utf8');
  assert.ok(fund.includes('duplicate'), 'funding worker handles duplicate settlement');
  const liq = fs.readFileSync(path.join(root, 'scripts', 'perp-liquidation-worker.js'), 'utf8');
  assert.ok(liq.includes('mark price stale'), 'liquidation worker pauses on stale mark');
  assert.ok(liq.includes('BAD DEBT'), 'liquidation worker escalates bad debt');
});


test('perpetual read API response fields match the frontend adapters', () => {
  const orders = routeSlice("path === 'perpetual/orders' && method === 'GET'", "path === 'perpetual/positions' && method === 'GET'");
  assert.ok(orders.includes('open: open, history: history'));
  const positions = routeSlice("path === 'perpetual/positions' && method === 'GET'", "path === 'perpetual/trades' && method === 'GET'");
  assert.ok(positions.includes('select=id,symbol,side,quantity'));
  assert.ok(positions.includes('position_id: p.id'));
  const funding = routeSlice("path === 'perpetual/funding' && method === 'GET'", "path === 'support/chat' && method === 'POST'");
  assert.ok(funding.includes('history: history, rates: rates'));
});


test('perpetual market reads expose only fresh mark/index feed values', () => {
  const route = routeSlice("path === 'perpetual/markets' && method === 'GET'", "path === 'perpetual/order' && method === 'POST'");
  assert.ok(route.includes("perp_latest_mark_price"));
  assert.ok(route.includes("['ok', 'degraded'].includes(row.status)"));
  assert.ok(route.includes("mark_price: fresh ? String(row.mark_price) : null"));
  assert.ok(route.includes("index_price: fresh ? String(row.index_price) : null"));
  assert.ok(route.includes("mark_price_status: fresh ? row.status : 'stale'"));
});


test('perpetual trade history maps database IDs, participant side and own fee to UI fields', () => {
  const route = routeSlice("path === 'perpetual/trades' && method === 'GET'", "path === 'perpetual/funding' && method === 'GET'");
  assert.ok(route.includes("perpetual_orders?select=id,side&id=in."));
  assert.ok(route.includes("trade_id: t.id"));
  assert.ok(route.includes("side: orderSides.get(orderId)"));
  assert.ok(route.includes("fee: maker ? t.maker_fee : t.taker_fee"));
});


test('perpetual funding settlement updates funding_paid once and cannot borrow another position margin', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'sql', '0041_perpetual_contract_v1.sql'), 'utf8');
  const start = migration.indexOf('create or replace function public.perp_settle_funding_one(');
  const end = migration.indexOf('-- Liquidation check + execute.', start);
  assert.ok(start >= 0 && end > start, 'funding settlement function must exist');
  const fn = migration.slice(start, end);
  assert.equal((fn.match(/funding_paid\s*=\s*funding_paid\s*-\s*v_payment/g) || []).length, 1,
    'funding_paid must be accumulated exactly once per settlement');
  assert.ok(fn.includes('then -v_rate.rate else v_rate.rate'),
    'settlement amount must use the persisted funding rate, not caller input');
  assert.ok(fn.includes('where id=v_pos.id and isolated_margin >= -v_from_margin'),
    'funding debit must be bounded by this position isolated margin');
  assert.ok(fn.includes("raise exception 'funding isolated margin invariant failed'"),
    'funding debit must fail closed when isolated margin is insufficient');
});

test('perpetual migration preserves existing production financial operation types', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'sql', '0041_perpetual_contract_v1.sql'), 'utf8');
  for (const operation of ['withdraw_settle', 'withdraw_paid', 'seconds_open', 'seconds_settle',
    'spot_trade', 'deposit_credit', 'admin_adjustment', 'perp_trade', 'perp_liquidation']) {
    assert.ok(migration.includes("'" + operation + "'"), 'missing operation type: ' + operation);
  }
});


test('perpetual liquidation solves thresholds and routes excess loss through insurance/bad-debt waterfall', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'sql', '0041_perpetual_contract_v1.sql'), 'utf8');
  const start = migration.indexOf('create or replace function public.perp_liquidate_position(');
  const end = migration.indexOf('$$;', start);
  const fn = migration.slice(start, end);
  assert.ok(fn.includes('(v_pos.entry_price*v_pos.quantity-v_pos.isolated_margin) /'));
  assert.ok(fn.includes('(v_pos.entry_price*v_pos.quantity+v_pos.isolated_margin) /'));
  assert.ok(fn.includes('v_close_price := v_mark.mark_price'));
  assert.ok(fn.includes('v_bad_debt := v_excess - v_insurance_cover'));
  assert.ok(fn.includes('v_orders_reserved + v_margin_return'));
  assert.ok(fn.includes('least(v_loss,v_pos.isolated_margin)'));
});

test('perpetual cancellation uses a distinct operation id for the release ledger', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'sql', '0041_perpetual_contract_v1.sql'), 'utf8');
  const start = migration.indexOf('create or replace function public.perp_cancel_order(');
  const end = migration.indexOf('$$;', start);
  const fn = migration.slice(start, end);
  assert.ok(fn.includes('v_cancel_op_id uuid'));
  assert.ok(fn.includes('returning id into v_cancel_op_id'));
  assert.ok(fn.includes('select v_cancel_op_id, p_user_id'));
  assert.ok(!fn.includes('returning id into v_order.reserve_operation_id'));
});


test('perpetual mark feed rejects invalid, stale, or source-detached prices', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'sql', '0041_perpetual_contract_v1.sql'), 'utf8');
  const start = migration.indexOf('create or replace function public.perp_record_mark_price(');
  const end = migration.indexOf('$$;', start);
  const fn = migration.slice(start, end);
  assert.ok(fn.includes("raise exception 'invalid mark price payload'"));
  assert.ok(fn.includes("raise exception 'invalid or stale mark price source'"));
  assert.ok(fn.includes("mark/index price must match validated source mean"));
  assert.ok(fn.includes("abs(extract(epoch from now())*1000"));
});


test('perpetual matching caps maker reduce-only fills to live opposite position and cancels exhausted remainder', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'sql', '0041_perpetual_contract_v1.sql'), 'utf8');
  const start = migration.indexOf('create or replace function public.perp_submit_order(');
  const end = migration.indexOf('$$;', start);
  const fn = migration.slice(start, end);
  assert.ok(fn.includes('v_maker_reducible_remaining'));
  assert.ok(fn.includes("((side='long' and v_maker.side='sell') or (side='short' and v_maker.side='buy'))"));
  assert.ok(fn.includes('coalesce(v_maker_reducible_remaining, v_maker.remaining_quantity)'));
  assert.ok(fn.includes("where id=v_maker.id and status in ('open','partially_filled')"));
});


test('liquidation records insurance funding and bad debt as explicit auditable operations', () => {
  const migration = fs.readFileSync(path.join(root, 'supabase', 'sql', '0041_perpetual_contract_v1.sql'), 'utf8');
  assert.match(migration, /insert into public\.financial_accounts\(user_id,asset\) values \(v_market\.insurance_user_id,'USDT'\) on conflict do nothing/i);
  assert.match(migration, /insurance fee credit invariant failed/i);
  assert.match(migration, /insurance liquidation debit invariant failed/i);
  assert.match(migration, /operation_type,request_hash,metadata\)[\s\S]*?'perp_bad_debt'/i);
  assert.match(migration, /create table if not exists public\.perpetual_bad_debt_events/i);
  assert.match(migration, /insert into public\.perpetual_bad_debt_events/i);
  assert.match(migration, /order reserve operation missing/i);
});

test('funding worker retries failed settlements and never advances the boundary after a partial failure', () => {
  const fund = fs.readFileSync(path.join(root, 'scripts', 'perp-funding-worker.js'), 'utf8');
  assert.ok(fund.includes('async function restGetAll(query)'));
  assert.ok(fund.includes("'Range-Unit': 'items'"));
  assert.ok(fund.includes('if (marketFailed)'));
  assert.ok(fund.includes('boundary NOT advanced'));
  assert.ok(fund.indexOf('if (marketFailed)') < fund.indexOf('funding settled marker'));
  assert.ok(fund.includes("if (!r.ok) throw new Error('REST GET failed: ' + r.status)"));
  assert.ok(fund.includes("if (!rateResponse.ok) throw new Error('funding rate insert failed"));
});

test('liquidation worker paginates every position and does not convert REST failures into an empty position set', () => {
  const liq = fs.readFileSync(path.join(root, 'scripts', 'perp-liquidation-worker.js'), 'utf8');
  assert.ok(liq.includes('async function restGetAll(query)'));
  assert.ok(liq.includes("'Range-Unit': 'items'"));
  assert.ok(liq.includes('for (let offset = 0; offset < 500000; offset += PAGE_SIZE)'));
  assert.ok(liq.includes("if (!r.ok) throw new Error('REST GET failed: ' + r.status)"));
  assert.ok(!liq.includes('&limit=500'));
});

test('perpetual workers validate RPC success payloads before counting settlements or liquidations', () => {
  const fund = fs.readFileSync(path.join(root, 'scripts', 'perp-funding-worker.js'), 'utf8');
  const liq = fs.readFileSync(path.join(root, 'scripts', 'perp-liquidation-worker.js'), 'utf8');
  assert.ok(fund.includes("res.ok !== true"));
  assert.ok(liq.includes("res.ok !== true"));
});
