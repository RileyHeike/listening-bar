/**
 * Seed a deployed preview's backend with the fixture snapshot, through the
 * dev-only publish route, so E2E tests see the same lively room as local
 * builds (fixtures never ship in preview builds).
 *
 *   BAR_API_URL=https://… tsx apps/web/integration/seed.ts
 */
import { registry } from '@bar/core';
import { fixtureSnapshot } from '@bar/fixtures';
import { createApiClient } from '@bar/room';

const base = process.env.BAR_API_URL;
if (!base) throw new Error('Set BAR_API_URL to the backend to seed.');
const api = createApiClient(`${base.replace(/\/$/, '')}/api`);

for (const envelope of fixtureSnapshot()) {
  if (!registry.has(envelope.type)) continue;
  const { id } = await api.request('POST /room/dev/publish', {
    type: envelope.type,
    data: envelope.data,
  });
  console.log(`Seeded ${envelope.type} (${id})`);
}
