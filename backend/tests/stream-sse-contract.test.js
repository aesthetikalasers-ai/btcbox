'use strict';
// SSE endpoint contract tests.
//
// The handlers are exercised against a fake http response object so the tests
// stay hermetic: no network, no timers left running, no provider dependency.
const test = require('node:test');
const assert = require('node:assert');

const streamApi = require('../stream-api.js');
const core = require('../stream-core.js');

/** Minimal stand-in for a Node `res` that records SSE frames. */
function createFakeRes() {
  const chunks = [];
  const listeners = {};
  return {
    statusCode: 0,
    headers: {},
    writableEnded: false,
    destroyed: false,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    flushHeaders() { /* no-op */ },
    write(chunk) { chunks.push(String(chunk)); return true; },
    end(chunk) { if (chunk !== undefined) chunks.push(String(chunk)); this.writableEnded = true; },
    on(event, handler) { (listeners[event] = listeners[event] || []).push(handler); },
    get chunks() { return chunks; },
    get joined() { return chunks.join(''); },
    emit(event) { (listeners[event] || []).forEach((fn) => fn()); },
  };
}

function createReq(url, method = 'GET') {
  const listeners = {};
  return {
    url,
    method,
    headers: {},
    on(event, handler) { (listeners[event] = listeners[event] || []).push(handler); },
    emit(event) { (listeners[event] || []).forEach((fn) => fn()); },
  };
}

test('rejects unknown stream channels with 404', async () => {
  const res = createFakeRes();
  await streamApi(createReq('/api/stream/prices'), res);
  assert.strictEqual(res.statusCode, 404);
  assert.match(res.joined, /UNKNOWN_STREAM/);
});

test('rejects non-GET methods with 405', async () => {
  const res = createFakeRes();
  await streamApi(createReq('/api/stream/depth', 'POST'), res);
  assert.strictEqual(res.statusCode, 405);
  assert.strictEqual(res.headers.allow, 'GET');
});

test('rejects malformed symbols before opening a stream', async () => {
  const res = createFakeRes();
  await streamApi(createReq('/api/stream/depth?symbol=../../etc/passwd'), res);
  assert.strictEqual(res.statusCode, 400);
  assert.match(res.joined, /INVALID_SYMBOL/);
});

test('rejects non-USDT quotes', async () => {
  const res = createFakeRes();
  await streamApi(createReq('/api/stream/depth?symbol=BTCJPY'), res);
  assert.strictEqual(res.statusCode, 400);
});

test('sets the SSE response headers', async () => {
  // Block the network so the handler returns as soon as the first frame is written.
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  try {
    const res = createFakeRes();
    const req = createReq('/api/stream/depth?symbol=BTCUSDT');
    const pending = streamApi(req, res);
    // Allow the first emit to settle.
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(res.statusCode, 200);
    assert.match(String(res.headers['content-type']), /text\/event-stream/);
    assert.match(String(res.headers['cache-control']), /no-cache/);
    assert.strictEqual(res.headers['x-accel-buffering'], 'no');
    // Offline upstream must surface an error frame, never fabricated levels.
    assert.match(res.joined, /event: stream-error/);
    assert.match(res.joined, /DEPTH_DATA_UNAVAILABLE/);
    assert.doesNotMatch(res.joined, /"bids":\[\[/);
    req.emit('close');
    assert.strictEqual(res.writableEnded, false, 'request completion must not close the SSE response');
    res.emit('close');
    await pending;
  } finally {
    global.fetch = originalFetch;
  }
});

test('emits hello frame with channel and interval', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  try {
    const res = createFakeRes();
    const req = createReq('/api/stream/trades?symbol=ETHUSDT');
    const pending = streamApi(req, res);
    await new Promise((resolve) => setImmediate(resolve));
    assert.match(res.joined, /event: hello/);
    assert.match(res.joined, /"channel":"trades"/);
    assert.match(res.joined, /"symbol":"ETHUSDT"/);
    req.emit('close');
    res.emit('close');
    await pending;
  } finally {
    global.fetch = originalFetch;
  }
});

test('cleans up immediately when the client disconnects during the first upstream read', async () => {
  let releaseFetch;
  const pendingFetch = new Promise((resolve) => { releaseFetch = resolve; });
  const originalFetch = global.fetch;
  global.fetch = async () => {
    await pendingFetch;
    throw new Error('offline');
  };
  try {
    const res = createFakeRes();
    const pending = streamApi(createReq('/api/stream/depth?symbol=BTCUSDT'), res);
    await new Promise((resolve) => setImmediate(resolve));

    // The initial provider request is still pending. The response close event
    // must already be observed and cleanup must run without waiting for it.
    res.emit('close');
    assert.strictEqual(res.writableEnded, true, 'disconnect during first poll must close immediately');

    releaseFetch();
    await pending;
  } finally {
    global.fetch = originalFetch;
  }
});

test('normalizes levels and drops malformed rows', () => {
  const rows = [['100', '1'], ['bad', '2'], ['99', '0'], ['98', '3'], null, ['97']];
  const levels = core.normalizeLevels(rows);
  assert.deepStrictEqual(levels, [['100', '1'], ['98', '3']]);
});

test('stream intervals are sane', () => {
  assert.ok(core.DEPTH_INTERVAL_MS >= 1000, 'depth polls must not hammer providers');
  assert.ok(core.UPSTREAM_TIMEOUT_MS < core.DEPTH_INTERVAL_MS, 'upstream timeout must be shorter than the emit interval');
  assert.ok(core.MAX_STREAM_MS <= 15 * 60 * 1000, 'stream lifetime must be bounded');
});

test('cleans up timers when the client disconnects', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('offline'); };
  try {
    const res = createFakeRes();
    const req = createReq('/api/stream/depth?symbol=BTCUSDT');
    const pending = streamApi(req, res);
    await new Promise((resolve) => setImmediate(resolve));
    res.emit('close');
    await pending;
    assert.strictEqual(res.writableEnded, true, 'response must be closed on client disconnect');
  } finally {
    global.fetch = originalFetch;
  }
});
