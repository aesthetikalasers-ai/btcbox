import { expect, test } from '@playwright/test';

test('an account read timeout becomes a recoverable service error, never an empty account', async ({ page }) => {
  test.setTimeout(15000);
  await page.clock.install();
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { ok: false } }));
  let started = false;
  let release: (() => void) | undefined;
  await page.route('**/api/orders', async route => {
    started = true;
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ json: { ok: true, orders: [] } }).catch(() => {});
  });
  await page.goto('/home');
  const read = page.evaluate(async () => {
    const path = '/src/lib/api.ts';
    try { await (await import(path)).getOrders(); return { code: 'unexpected success' }; }
    catch (error) { return { code: (error as { code?: string }).code }; }
  });
  await expect.poll(() => started).toBe(true);
  await page.clock.fastForward(15001);
  expect(await read).toEqual({ code: 'NETWORK_ERROR' });
  release?.();
  await page.route('**/api/orders', route => route.fulfill({ json: { ok: true, orders: [] } }));
  expect(await page.evaluate(async () => {
    const path = '/src/lib/api.ts';
    return (await import(path)).getOrders();
  })).toEqual([]);
});

test('an explicitly cancelled account read preserves cancellation', async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.goto('/home');
  expect(await page.evaluate(async () => {
    const path = '/src/lib/api.ts';
    const api = await import(path);
    const controller = new AbortController();
    controller.abort();
    try { await api.getOrders(controller.signal); return 'unexpected success'; }
    catch (error) { return (error as Error).name; }
  })).toBe('AbortError');
});
