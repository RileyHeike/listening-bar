import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const PAGES = ['/', '/workshop', '/workshop/featured-release', '/liner-notes'] as const;

/** Collect console errors and uncaught exceptions for the life of the page. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);
}

/** Mark the window so a later check can tell a client-side navigation from a full reload. */
export async function markWindow(page: Page) {
  await page.evaluate(() => {
    (window as unknown as { __barMark: boolean }).__barMark = true;
  });
}

export async function expectSameWindow(page: Page) {
  expect(await page.evaluate(() => (window as unknown as { __barMark?: boolean }).__barMark)).toBe(
    true,
  );
}

/**
 * Scroll an element into view and wait until the island containing it has
 * hydrated (Astro removes the `ssr` attribute), so interactions are live.
 */
export async function hydrated(locator: Locator): Promise<Locator> {
  await locator.first().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      locator.first().evaluate((el) => el.closest('astro-island')?.hasAttribute('ssr') ?? false),
    )
    .toBe(false);
  return locator;
}
