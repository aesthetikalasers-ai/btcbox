import { expect, test, type Route } from '@playwright/test';

// Local dictionaries and an isolated signed-out auth fixture; these cases never
// contact a provider or operate on a trading account.
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/api/auth-client-config') return route.fulfill({ json: {
      ok: true, supabase_url: 'https://btcbox-e2e.invalid', publishable_key: 'e2e-local-public-key', google_enabled: false, wallet_enabled: false,
    } });
    return route.fulfill({ status: pathname === '/api/account' ? 401 : 503, json: { ok: false, need_login: true } });
  });
  await page.route('https://btcbox-e2e.invalid/**', route => route.abort());
});
const isDictionary = (route: Route) => route.request().resourceType() === 'fetch';

test('languages load on demand, cache in memory and persist across navigation and reload', async ({ page }) => {
  const requested: string[] = [];
  page.on('request', request => {
    if (request.resourceType() === 'fetch' && /\.json(?:\?|$)/.test(request.url())) requested.push(request.url());
  });
  await page.goto('/login');
  await expect(page.getByLabel('Username', { exact: true })).toBeVisible();
  expect(requested).toHaveLength(0);
  await page.locator('select').selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  expect(requested).toHaveLength(1);
  await page.locator('select').selectOption('es');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-ES');
  expect(requested).toHaveLength(2);
  await page.locator('select').selectOption('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  expect(requested).toHaveLength(2);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('btcbox-language'))).toBe('de');
  await page.locator('a[href="/home"]:visible').last().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  await page.reload();
  await expect(page.locator('header select')).toHaveValue('de');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
});

test('a failed language request can retry without losing form input or the saved preference', async ({ page }) => {
  let attempts = 0;
  await page.route('**/de*.json*', async route => {
    if (!isDictionary(route)) return route.fallback();
    if (++attempts === 1) return route.abort();
    return route.continue();
  });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('retained-name');
  await page.locator('select').selectOption('de');
  await expect(page.getByRole('alert')).toContainText('Unable to load this language. Please try again.');
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('retained-name');
  expect(await page.evaluate(() => localStorage.getItem('btcbox-language'))).toBe('en');
  await page.getByRole('alert').getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  await expect(page.getByLabel('Benutzername', { exact: true })).toHaveValue('retained-name');
  expect(attempts).toBe(2);
});

test('a late language response cannot replace the latest selection', async ({ page }) => {
  let release: (() => void) | undefined;
  await page.route('**/de*.json*', async route => {
    if (!isDictionary(route)) return route.fallback();
    await new Promise<void>(resolve => { release = resolve; });
    await route.continue();
  });
  await page.goto('/login');
  await page.locator('select').selectOption('de');
  await expect.poll(() => !!release).toBe(true);
  await page.locator('select').selectOption('it');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it-IT');
  const lateResponse = page.waitForResponse(response => response.request().resourceType() === 'fetch' && /\/de.*\.json/.test(response.url()));
  release!();
  await (await lateResponse).finished();
  // Fetching an already cached locale and back also exercises the stale request's cleanup.
  await page.locator('select').selectOption('en');
  await page.locator('select').selectOption('it');
  await expect(page.locator('html')).toHaveAttribute('lang', 'it-IT');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('btcbox-language'))).toBe('it');
});

test('a stalled language request times out and leaves the current page usable', async ({ page }) => {
  await page.clock.install();
  let release: (() => void) | undefined;
  await page.route('**/de*.json*', async route => {
    if (!isDictionary(route)) return route.fallback();
    await new Promise<void>(resolve => { release = resolve; });
    await route.continue().catch(() => {});
  });
  await page.goto('/login');
  await page.getByLabel('Username', { exact: true }).fill('keep-this-form');
  await page.locator('select').selectOption('de');
  await expect.poll(() => !!release).toBe(true);
  await page.clock.fastForward(10_001);
  await expect(page.getByRole('alert')).toContainText('Unable to load this language. Please try again.');
  await page.getByRole('alert').getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue('keep-this-form');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  release!();
});

test('an invalid saved-language response shows a recoverable state before rendering forms', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('btcbox-language', 'de'));
  let invalid = true;
  await page.route('**/de*.json*', route => {
    if (!isDictionary(route)) return route.fallback();
    return invalid ? route.fulfill({ json: { Language: 'Deutsch' } }) : route.continue();
  });
  await page.goto('/login');
  await expect(page.getByRole('alert')).toContainText('Diese Sprache konnte nicht geladen werden.');
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  await expect(page.locator('input')).toHaveCount(0);
  invalid = false;
  await page.getByRole('alert').getByRole('button').last().click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'de-DE');
  await expect(page.getByLabel('Benutzername', { exact: true })).toBeVisible();
});


test('Admin language is bundled and preserves the customer preference', async ({ page }) => {
  let requests = 0;
  await page.route('**/zh-CN*.json*', route => {
    if (!isDictionary(route)) return route.fallback();
    requests++;
    return route.abort();
  });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '欢迎回来', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  expect(requests).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('btcbox-language'))).toBe('en');
});

test('a permanently unavailable saved language can fall back without clearing storage', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('btcbox-language', 'de'));
  await page.route('**/de*.json*', route => isDictionary(route) ? route.abort() : route.fallback());
  await page.goto('/login');
  await page.getByRole('alert').getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('btcbox-language'))).toBe('en');
});
