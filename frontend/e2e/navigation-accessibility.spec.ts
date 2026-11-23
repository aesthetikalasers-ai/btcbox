import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Navigation is local and must remain usable when backend services are unavailable.
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
});

test('mobile primary navigation exposes all five destinations and supports keyboard activation', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav).toBeVisible();
  const destinations = ['Home', 'Markets', 'Trade', 'Assets', 'My'];
  for (const name of destinations) {
    await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
  }
  await expect(nav.getByRole('link')).toHaveCount(5);

  const markets = nav.getByRole('link', { name: 'Markets', exact: true });
  await markets.focus();
  await expect(markets).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(url => new URL(url).pathname === "/markets");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Markets', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('mobile primary navigation is hidden at desktop width and returns at mobile width', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(nav).toBeVisible();

  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(nav).toBeHidden();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: 'My', exact: true }).click();
  await expect(page).toHaveURL(url => new URL(url).pathname === "/me");
  await expect(nav).toBeVisible();
});
