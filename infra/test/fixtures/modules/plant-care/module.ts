import { defineModule } from '@bar/core';

/** Fixture module exercising every manifest field ModuleConstruct handles. */
export default defineModule({
  manifestVersion: 1,
  name: 'plant-care',
  routes: './src/routes.ts',
  access: { 'GET /': 'public' },
  table: {
    partitionKey: { name: 'pk', type: 'S' },
    sortKey: { name: 'sk', type: 'S' },
    indexes: [{ name: 'byDate', partitionKey: { name: 'date', type: 'S' } }],
    ttlAttribute: 'expiresAt',
  },
  emits: ['weather.changed'],
  jobs: [{ name: 'water', schedule: 'rate(1 day)', handler: './src/jobs/water.ts' }],
  secrets: ['sensor-token'],
  extensions: [{ use: 'queue', options: { fifo: false } }],
});
