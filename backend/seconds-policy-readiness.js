'use strict';

// Runtime capability check for the versioned Seconds policy migration.
// The legacy hosted RPC has the same argument signature but enforces a fixed
// duration allowlist and does not snapshot policy versions. Checking the active
// policy tables before any Seconds write prevents the old function from being
// used if financial cutover flags are accidentally enabled before migration.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function hasActiveVersionedSecondsPolicy(options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const baseUrl = String(env.SUPABASE_URL || '').trim().replace(/\\/+$/, '');
  const serviceKey = String(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '').trim();
  if (!/^https:\\/\\//i.test(baseUrl) || !serviceKey || /\\s/.test(serviceKey) || typeof fetchImpl !== 'function') return false;

  const headers = {
    apikey: serviceKey,
    Authorization: 'Bearer ' + serviceKey,
    Accept: 'application/json'
  };
  try {
    const activeResponse = await fetchImpl(
      baseUrl + '/rest/v1/seconds_contract_policy_active?select=policy_id&limit=1',
      { method: 'GET', headers, signal: AbortSignal.timeout(4000) }
    );
    if (!activeResponse.ok) return false;
    const activeRows = await activeResponse.json();
    if (!Array.isArray(activeRows) || activeRows.length !== 1) return false;
    const policyId = String(activeRows[0] && activeRows[0].policy_id || '');
    if (!UUID_RE.test(policyId)) return false;

    const policyResponse = await fetchImpl(
      baseUrl + '/rest/v1/seconds_contract_policies?select=policy_id,policy_version,symbols,durations_sec,min_stake,max_stake,payout_bps&policy_id=eq.' + encodeURIComponent(policyId) + '&limit=1',
      { method: 'GET', headers, signal: AbortSignal.timeout(4000) }
    );
    if (!policyResponse.ok) return false;
    const policies = await policyResponse.json();
    if (!Array.isArray(policies) || policies.length !== 1) return false;
    const policy = policies[0];
    const version = Number(policy && policy.policy_version);
    const minStake = Number(policy && policy.min_stake);
    const maxStake = Number(policy && policy.max_stake);
    const payoutBps = Number(policy && policy.payout_bps);
    return String(policy.policy_id || '').toLowerCase() === policyId.toLowerCase() &&
      Number.isSafeInteger(version) && version > 0 &&
      Array.isArray(policy.symbols) && policy.symbols.length > 0 &&
      policy.symbols.every(symbol => ['BTC', 'ETH', 'SOL', 'BNB'].includes(symbol)) &&
      Array.isArray(policy.durations_sec) && policy.durations_sec.length > 0 &&
      policy.durations_sec.every(duration => Number.isSafeInteger(duration) && duration > 0) &&
      Number.isFinite(minStake) && minStake > 0 &&
      Number.isFinite(maxStake) && maxStake >= minStake &&
      Number.isSafeInteger(payoutBps) && payoutBps >= 8500;
  } catch (_) {
    return false;
  }
}

module.exports = Object.freeze({ hasActiveVersionedSecondsPolicy });
