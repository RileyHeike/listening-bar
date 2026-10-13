import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Page } from '@playwright/test';
import { test } from '@playwright/test';
import type { Phase } from '@bar/core';
import { PAGES } from '../e2e/support.ts';

/**
 * Captures, not assertions: every page in each mode, frozen at the same
 * moment, for `compare.ts` to diff against the screenshots from `main`.
 */
const OUT = join(import.meta.dirname, '..', 'visual-results', 'current');

/** Owner-local moments (PDT) inside each lighting phase; `evening` is the default. */
const PHASE_TIMES = {
  'after-hours': '04:00',
  dawn: '07:30',
  day: '13:00',
  golden: '18:00',
  evening: '20:30',
  night: '23:30',
} as const satisfies Record<Phase, string>;
const at = (time: string) => new Date(`2026-06-19T${time}:00-07:00`);

const MODES = {
  'lights-down': undefined,
  'lights-up': 'up',
} as const;

const slug = (path: string) => (path === '/' ? 'room' : path.slice(1).replaceAll('/', '--'));

async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  // Let islands hydrate and fill from the fixture snapshot.
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'));
}

async function capture(
  page: Page,
  project: string,
  { path, time, lights, name }: { path: string; time: string; lights?: string; name: string },
) {
  await page.clock.setFixedTime(at(time));
  if (lights)
    await page.addInitScript((value) => {
      localStorage.setItem('bar:lights', value);
    }, lights);
  await page.goto(path);
  await settle(page);
  const file = join(OUT, project, `${name}.png`);
  mkdirSync(dirname(file), { recursive: true });
  await page.screenshot({
    path: file,
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    scale: 'css',
  });
}

for (const [mode, lights] of Object.entries(MODES)) {
  for (const path of PAGES) {
    const name = `${slug(path)}.${mode}`;
    test(name, async ({ page }, info) => {
      await capture(page, info.project.name, { path, time: PHASE_TIMES.evening, lights, name });
    });
  }
}

for (const [phase, time] of Object.entries(PHASE_TIMES)) {
  if (phase === 'evening') continue;
  const name = `room.phase-${phase}`;
  test(name, async ({ page }, info) => {
    await capture(page, info.project.name, { path: '/', time, name });
  });
}
