'use strict';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_RE = /^[A-Z0-9]{2,16}$/;
const NETWORK_RE = /^[A-Z0-9_-]{2,24}$/;
const PAGE_SIZE = 50;

function response(status, body) {
  return { status, body: Object.assign({ request_id: require('node:crypto').randomUUID() }, body) };
}

function decimalToUnits(value) {
  const raw = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(raw)) throw new Error('Invalid wallet decimal');
  const parts = raw.split('.');
  return BigInt(parts[0]) * (10n ** 18n) + BigInt((parts[1] || '').padEnd(18, '0'));
}

function unitsToDecimal(units) {
  const whole = (units / (10n ** 18n)).toString();
  const fraction = (units % (10n ** 18n)).toString().padStart(18, '0').replace(/0+$/, '');
  return fraction ? whole + '.' + fraction : whole;
}

function normalizeAmount(value) {
  const raw = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(raw)) throw new Error('Invalid wallet decimal');
  return raw;
}

function normalizeSignedAmount(value) {
  const raw = String(value);
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(raw)) throw new Error('Invalid wallet decimal');
  return raw;
}

function getServerConfig() {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!base || !base.startsWith('https://') || !key) return null;
  return { base, key };
}

async function selectRows(table, params, config) {
  const query = new URLSearchParams(params);
  const url = config.base + '/rest/v1/' + table + '?' + query.toString();
  const result = await fetch(url, {
    method: 'GET',
    headers: {
      apikey: config.key,
      Authorization: 'Bearer ' + config.key,
      Accept: 'application/json'
    },
    signal: AbortSignal.timeout(7000)
  });
  if (!result.ok) throw new Error('Wallet database read failed');
  let rows;
  if (typeof result.text === 'function') {
    const raw = await result.text();
    // PostgREST emits PostgreSQL numeric/bigint columns as JSON numbers. Quote
    // wallet monetary values and ledger IDs before parsing so JS never rounds them.
    const lossless = raw.replace(/(?<!\\)("(?:available|frozen|available_delta|frozen_delta|available_after|frozen_after|ledger_id)"\s*:\s*)(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, '$1"$2"');
    rows = JSON.parse(lossless);
  } else {
    // Compatibility for lightweight unit-test response doubles. Real Fetch
    // Response objects always expose text(), so production reads stay lossless.
    rows = await result.json();
  }
  if (!Array.isArray(rows)) throw new Error('Wallet database response invalid');
  return rows;
}

function apiError(status, code, msg) {
  return response(status, { ok: false, code, msg });
}

async function handleWalletRoute({ path, method, user, query: queryParams = {} }) {
  if (!/^wallet(?:\/|$)/.test(String(path || ''))) return null;

  if (!user) return apiError(401, 'UNAUTHENTICATED', 'Please sign in to access your wallet.');
  if (user.frozen) return apiError(403, 'ACCOUNT_FROZEN', 'This account is not permitted to access wallet services.');

  const userId = String(user.supabase_user_id || '').trim();
  if (!UUID_RE.test(userId)) {
    return apiError(403, 'WALLET_IDENTITY_UNAVAILABLE', 'The verified wallet identity could not be resolved.');
  }

  const config = getServerConfig();
  if (!config) return apiError(503, 'WALLET_SERVICE_UNAVAILABLE', 'Wallet service is temporarily unavailable.');

  if (path === 'wallet' && method === 'GET') {
    try {
      const rows = await selectRows('btcbox_wallet_accounts', {
        select: 'wallet_account_id,asset_code,available,frozen,version,updated_at',
        user_id: 'eq.' + userId,
        order: 'asset_code.asc',
        limit: String(PAGE_SIZE)
      }, config);

      const accounts = rows.map(row => {
        const available = normalizeAmount(row.available);
        const frozen = normalizeAmount(row.frozen);
        const total = unitsToDecimal(decimalToUnits(available) + decimalToUnits(frozen));
        const version = Number(row.version);
        if (!Number.isSafeInteger(version) || version < 0) throw new Error('Invalid wallet account version');
        return {
          asset: String(row.asset_code),
          available,
          frozen,
          total,
          version,
          updated_at: row.updated_at
        };
      });

      const updatedAt = accounts.map(account => account.updated_at).filter(Boolean).sort().slice(-1)[0] || null;
      return response(200, { ok: true, wallet: { accounts, updated_at: updatedAt } });
    } catch (_) {
      return apiError(503, 'WALLET_READ_UNAVAILABLE', 'Wallet balances are temporarily unavailable.');
    }
  }

  if (path === 'wallet/addresses' && method === 'GET') {
    const asset = queryParams.asset === undefined ? '' : String(queryParams.asset).trim().toUpperCase();
    const network = queryParams.network === undefined ? '' : String(queryParams.network).trim().toUpperCase();
    if (asset && !ASSET_RE.test(asset)) return apiError(400, 'INVALID_ASSET', 'Invalid asset filter.');
    if (network && !NETWORK_RE.test(network)) return apiError(400, 'INVALID_NETWORK', 'Invalid network filter.');
    try {
      const query = { select: 'wallet_address_id,asset_code,network_code,address,address_status,is_primary,created_at', user_id: 'eq.' + userId, order: 'created_at.desc', limit: String(PAGE_SIZE) };
      if (asset) query.asset_code = 'eq.' + asset;
      if (network) query.network_code = 'eq.' + network;
      const rows = await selectRows('btcbox_wallet_addresses', query, config);
      return response(200, {
        ok: true,
        addresses: rows.map(row => ({
          id: row.wallet_address_id,
          asset: row.asset_code,
          network: row.network_code,
          address: row.address,
          status: row.address_status,
          is_primary: row.is_primary === true,
          created_at: row.created_at
        }))
      });
    } catch (_) {
      return apiError(503, 'WALLET_ADDRESS_READ_UNAVAILABLE', 'Wallet addresses are temporarily unavailable.');
    }
  }

  if (path === 'wallet/ledger' && method === 'GET') {
      const asset = queryParams.asset === undefined ? '' : String(queryParams.asset).trim().toUpperCase();
    const cursor = queryParams.cursor === undefined ? '' : String(queryParams.cursor).trim();
    if (asset && !ASSET_RE.test(asset)) return apiError(400, 'INVALID_ASSET', 'Invalid asset filter.');
    if (cursor && !/^[1-9]\d{0,18}$/.test(cursor)) return apiError(400, 'INVALID_CURSOR', 'Invalid ledger cursor.');

    try {
      const query = {
        select: 'ledger_id,operation_id,asset_code,available_delta,frozen_delta,available_after,frozen_after,created_at',
        user_id: 'eq.' + userId,
        order: 'ledger_id.desc',
        limit: String(PAGE_SIZE + 1)
      };
      if (asset) query.asset_code = 'eq.' + asset;
      if (cursor) query.ledger_id = 'lt.' + cursor;
      const rows = await selectRows('btcbox_wallet_ledger', query, config);
      const hasMore = rows.length > PAGE_SIZE;
      const page = rows.slice(0, PAGE_SIZE);
      const operationIds = Array.from(new Set(page.map(row => String(row.operation_id)).filter(id => UUID_RE.test(id))));
      let operations = [];
      if (operationIds.length) {
        operations = await selectRows('btcbox_wallet_operations', {
          select: 'operation_id,operation_type,status',
          user_id: 'eq.' + userId,
          operation_id: 'in.(' + operationIds.join(',') + ')',
          limit: String(PAGE_SIZE)
        }, config);
      }
      const operationMap = new Map(operations.map(item => [String(item.operation_id), item]));
      const entries = page.map(row => {
        const operation = operationMap.get(String(row.operation_id));
        if (!operation) throw new Error('Wallet operation record missing');
        return {
          id: String(row.ledger_id),
          operation_id: row.operation_id,
          asset: row.asset_code,
          type: operation.operation_type,
          status: operation.status,
          available_delta: normalizeSignedAmount(row.available_delta),
          frozen_delta: normalizeSignedAmount(row.frozen_delta),
          available_after: normalizeAmount(row.available_after),
          frozen_after: normalizeAmount(row.frozen_after),
          created_at: row.created_at
        };
      });
      return response(200, {
        ok: true,
        entries,
        next_cursor: hasMore && page.length ? String(page[page.length - 1].ledger_id) : null
      });
    } catch (_) {
      return apiError(503, 'WALLET_LEDGER_UNAVAILABLE', 'Wallet transaction history is temporarily unavailable.');
    }
  }

  if (path === 'wallet/addresses' && method === 'POST') {
    return apiError(503, 'WALLET_PROVIDER_UNAVAILABLE', 'Address generation is not available until a custody provider is configured.');
  }

  if (['wallet/external/challenge', 'wallet/external/confirm', 'wallet/key-consents', 'wallet/keys'].includes(path)) {
    return apiError(503, 'WALLET_FEATURE_UNAVAILABLE', 'This wallet security feature is not available yet.');
  }

  return apiError(404, 'WALLET_ROUTE_NOT_FOUND', 'Wallet endpoint not found.');
}

module.exports = { handleWalletRoute, decimalToUnits, unitsToDecimal };
