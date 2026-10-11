import { expect, test } from '@playwright/test';
import { PAGES, expectNoHorizontalOverflow } from './support.ts';

test.describe('static shells without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the room is complete before any island runs', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.noren__panel')).toHaveCount(4);
    await expect(page.getByRole('heading', { name: /Pull up a stool/ })).toBeVisible();
    await expect(page.locator('.hifi__deck')).toBeVisible();
    await expect(page.getByText('Tuning in…')).toBeVisible();
    await expect(page.locator('.chalkboard__row')).toHaveCount(6);
    await expect(page.getByText('Looking outside…')).toBeVisible();
    await expect(page.locator('.record-wall__slot')).not.toHaveCount(0);
  });

  for (const path of PAGES) {
    test(`${path} renders and fits the viewport`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('main')).not.toBeEmpty();
      await expect(page.locator('.site-header')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
