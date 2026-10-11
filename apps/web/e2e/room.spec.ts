import { expect, test } from '@playwright/test';
import { PAGES, expectNoHorizontalOverflow, hydrated, watchErrors } from './support.ts';

test('every page loads without errors and fits the viewport', async ({ page }) => {
  const errors = watchErrors(page);
  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expectNoHorizontalOverflow(page);
  }
  expect(errors).toEqual([]);
});

test('the hi-fi fills from the snapshot and spins at 33⅓', async ({ page }) => {
  await page.goto('/');
  const hifi = page.locator('.hifi');
  await hydrated(hifi.locator('.hifi__console'));
  await expect(hifi.locator('.hifi__title')).toHaveText('[Track title]');
  await expect(hifi.locator('.hifi__arm')).toHaveAttribute('data-on-record');
  await expect(hifi.locator('.hifi__recent-name').first()).toHaveText('[Record one]');

  const angle = () =>
    hifi.locator('.hifi__record').evaluate((el) => (el as SVGGElement).style.transform);
  await page.waitForTimeout(2500);
  const first = await angle();
  await page.waitForTimeout(300);
  expect(await angle()).not.toBe(first);
});

test('live content replaces placeholders', async ({ page }) => {
  await page.goto('/');
  await hydrated(page.locator('.window'));
  await expect(page.locator('.window__status')).toHaveText('Light rain on the glass · 12°C');
  await expect(page.locator('.window__rain')).toHaveAttribute('data-raining');
  await hydrated(page.locator('.chalkboard__rows'));
  await expect(page.locator('.chalkboard__row dd').first()).toHaveText('[A record]');
});

test('lights up is plain, still, and remembered', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-motion', 'on');
  await page.getByRole('button', { name: 'Lights up' }).click();
  await expect(html).toHaveAttribute('data-lights', 'up');
  await expect(html).toHaveAttribute('data-motion', 'off');
  await page.reload();
  await expect(html).toHaveAttribute('data-lights', 'up');
  await expect(page.getByRole('button', { name: 'Lights down' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('switches decorative motion off and keeps the platter still', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'off');
    const hifi = page.locator('.hifi');
    await hydrated(hifi.locator('.hifi__console'));
    await expect(hifi.locator('.hifi__title')).toHaveText('[Track title]');
    await page.waitForTimeout(500);
    expect(
      await hifi.locator('.hifi__record').evaluate((el) => (el as SVGGElement).style.transform),
    ).toBe('');
  });
});

test('Side B flips the counter and is remembered', async ({ page }) => {
  await page.goto('/');
  const counter = page.locator('.counter');
  await (await hydrated(counter.getByRole('button', { name: 'Side B' }))).click();
  await expect(page.locator('html')).toHaveAttribute('data-side', 'B');
  await expect(counter.locator('[data-face="B"]')).toBeVisible();
  await expect(counter.locator('[data-face="A"]')).toBeHidden();
  await page.reload();
  await expect(counter.locator('[data-face="B"]')).toBeVisible();
});
