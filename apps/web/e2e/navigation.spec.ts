import type { Locator } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { expectSameWindow, hydrated, markWindow } from './support.ts';

const transitionName = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).viewTransitionName);

test('a wall sleeve morphs into the Workshop hero', async ({ page }) => {
  await page.goto('/');
  const sleeve = page.locator('.record-wall').getByRole('link', { name: /Workshop/ });
  expect(await transitionName(sleeve.locator('.bar-sleeve__cover'))).toBe(
    'sleeve-workshop-featured',
  );
  await markWindow(page);
  await sleeve.click();
  await expect(page).toHaveURL(/\/workshop$/);
  await expectSameWindow(page);
  expect(await transitionName(page.locator('.featured__cover'))).toBe('sleeve-workshop-featured');
});

test('a wall sleeve morphs into the Liner Notes meishi', async ({ page }) => {
  await page.goto('/');
  await markWindow(page);
  await page
    .locator('.record-wall')
    .getByRole('link', { name: /Liner Notes/ })
    .click();
  await expect(page).toHaveURL(/\/liner-notes$/);
  await expectSameWindow(page);
  expect(await transitionName(page.locator('.liner-intro__card'))).toBe('sleeve-liner-intro');
});

test('draft sleeves lead to a "being built" page', async ({ page }) => {
  await page.goto('/');
  await page.locator('.record-wall').getByRole('link', { name: /Crate/ }).click();
  await expect(page).toHaveURL(/\/crate$/);
  await expect(page.getByText('Still being pressed')).toBeVisible();
});

test('the shelf filters, and a project opens as an album', async ({ page }) => {
  await page.goto('/workshop');
  const shelf = page.locator('.shelf');
  const items = shelf.locator('.shelf__item');
  const all = await items.count();
  await (await hydrated(shelf.getByRole('button', { name: 'Demo tapes' }))).click();
  await expect(shelf.getByRole('button', { name: 'Demo tapes' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(items).not.toHaveCount(all);
  await expect(items.locator('.bar-cassette')).toHaveCount(await items.count());

  await markWindow(page);
  await items.first().getByRole('link').click();
  await expect(page).toHaveURL(/\/workshop\/[a-z-]+$/);
  await expectSameWindow(page);
  await expect(page.locator('.album')).toBeVisible();
});

test('the meishi turns over', async ({ page }) => {
  await page.goto('/liner-notes');
  await (await hydrated(page.getByRole('button', { name: 'Turn the card over' }))).click();
  await expect(page.locator('.meishi')).toHaveAttribute('data-flipped');
  await expect(page.getByRole('button', { name: 'Turn the card back' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('the contact form explains itself', async ({ page }) => {
  await page.goto('/liner-notes');
  const form = page.locator('.contact__form');
  await (await hydrated(form.getByRole('button', { name: 'Leave the note' }))).click();
  await expect(form.getByText('Add your name.')).toBeVisible();
  await form.getByLabel('Name').fill('A visitor');
  await form.getByLabel('Email').fill('visitor@example.com');
  await form.getByLabel('Message').fill('Lovely little bar you have here.');
  await form.getByRole('button', { name: 'Leave the note' }).click();
  await expect(form.getByRole('status')).toContainText("isn't connected yet");
});
