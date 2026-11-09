import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Only unavailable service states: navigation must work without provider access.
  await page.route('**/api/**', route => route.fulfill({ status: 503, json: { ok: false } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/home');
});

test('mobile navigation contains keyboard focus and restores it after Escape', async ({ page }) => {
  const trigger = page.getByRole('button', { name: 'Open navigation', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Mobile navigation' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('desktop resize releases the mobile modal and navigation links close it', async ({ page }) => {
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Mobile navigation' });
  await dialog.getByRole('link', { name: 'Markets', exact: true }).click();
  await expect(page).toHaveURL(/\/markets$/);
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(dialog).not.toBeVisible();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('de');
  await expect(page.getByRole('combobox', { name: 'Sprache' })).toHaveValue('de');
});
