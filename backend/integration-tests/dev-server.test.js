'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const { once } = require('node:events');

test('local integration serves real JSON APIs and SPA deep links on one origin', { timeout: 20000 }, async t => {
  const child = spawn(process.execPath, [path.join(__dirname, '../scripts/dev-server.js')], {
    // No inherited provider secrets or financial opt-ins in this integration check.
    env: { PATH: process.env.PATH, CONTEXT: 'dev', BTCBOX_DEV_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const force = setTimeout(() => child.kill('SIGKILL'), 3000);
    await exited;
    clearTimeout(force);
  });
  let stdoutLog = '';
  let stderrLog = '';
  child.stdout.on('data', data => { stdoutLog += data; });
  child.stderr.on('data', data => { stderrLog += data; });
  const port = await new Promise((resolve, reject) => {
    const formatLogs = () => {
      const parts = [];
      if (stderrLog.trim()) parts.push(`stderr:\n${stderrLog.trim()}`);
      if (stdoutLog.trim()) parts.push(`stdout:\n${stdoutLog.trim()}`);
      return parts.length ? `\n${parts.join('\n')}` : '';
    };
    const timer = setTimeout(() => reject(new Error(`Local server did not become ready${formatLogs()}`)), 12000);
    child.once('error', reject);
    child.once('exit', (code, signal) => { clearTimeout(timer); reject(new Error(`Server exited ${code ?? signal}${formatLogs()}`)); });
    child.stdout.on('data', () => {
      const match = stdoutLog.match(/listening on port (\d+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  const base = `http://127.0.0.1:${port}`;
  const malformedStatus = await new Promise((resolve, reject) => {
    require('node:http').get({ hostname: '127.0.0.1', port, path: 'http://[' }, response => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(malformedStatus, 400);
  const health = await fetch(base + '/api/healthz');
  assert.equal((await health.json()).ok, true);
  const market = await fetch(base + '/api/market');
  // A local server without an explicitly configured market catalogue must not
  // substitute seeded prices. The public market endpoint fails closed instead.
  assert.equal(market.status, 503);
  assert.match(market.headers.get('content-type'), /application\/json/);
  const marketPayload = await market.json();
  assert.equal(marketPayload.ok, false);
  assert.equal(marketPayload.code, 'MARKET_CATALOG_UNAVAILABLE');
  assert.deepEqual(marketPayload.markets, []);
  assert.deepEqual(marketPayload.data, {});
  const page = await fetch(base + '/trade/BTCUSDT');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /id="root"/);
  const consent = await fetch(base + '/oauth/consent');
  const consentHtml = await consent.text();
  assert.match(consentHtml, /Authorize Application/);
  assert.match(consentHtml, /href="\/login"/);
  assert.match(consentHtml, /href="\/settings"/);
  const consentScript = await fetch(base + '/oauth/consent.js');
  assert.match(consentScript.headers.get('content-type'), /text\/javascript/);
  const callback = await fetch(base + '/auth/callback?code=test-code', { redirect: 'manual' });
  assert.equal(callback.headers.get('location'), '/auth/react-callback?code=test-code');
});
