import { expect, test } from '@playwright/test';

test('chart responses are ordered and unique at the chart time precision', async ({ page }) => {
  await page.route('**/api/kline?**', route => route.fulfill({ json: { ok: true, source: 'isolated-test', klines: [
    { time: 2000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 1000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
    { time: 2500, open: 10, high: 13, low: 9, close: 12, volume: 2 },
    { time: -1000, open: 10, high: 12, low: 9, close: 11, volume: 1 },
  ] } }));
  await page.goto('/home');
  const candles = await page.evaluate(async () => {
    const path = '/src/lib/api.ts';
    return (await import(path)).getKlines('BTCUSDT');
  });
  expect(candles.map((c: { time: number }) => c.time)).toEqual([1000, 2500]);
  expect(candles[1].close).toBe(12);
});

test('a hanging chart request times out and a later request can recover', async ({ page }) => {
  test.setTimeout(15000);
  await page.clock.install();
  let attempts = 0;
  let release: (() => void) | undefined;
  await page.route('**/api/kline?**', async route => {
    attempts += 1;
    if (attempts === 1) await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { ok: true, klines: [] } }).catch(() => {});
  });
  await page.goto('/home');
  const first = page.evaluate(async () => {
    const path = '/src/lib/api.ts';
    try { await (await import(path)).getKlines('BTCUSDT'); return 'unexpected success'; }
    catch (error) { return (error as Error).name; }
  });
  await expect.poll(() => attempts).toBe(1);
  await page.clock.fastForward(15001);
  expect(await first).toBe('AbortError');
  release?.();
  const recovered = await page.evaluate(async () => {
    const path = '/src/lib/api.ts';
    return (await import(path)).getKlines('BTCUSDT');
  });
  expect(recovered).toEqual([]);
  expect(attempts).toBe(2);
});
