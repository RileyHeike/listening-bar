import { defineFixtures } from '../define.ts';

export default defineFixtures('spins.updated', [
  {
    label: 'Three recent spins',
    data: {
      spins: [
        { title: '[Record one]', artist: '[Artist]', year: 1958 },
        { title: '[Record two]', artist: '[Quintet]', year: 1961 },
        { title: '[Record three]', artist: '[Pianist]', year: 1975 },
      ],
    },
  },
  { label: 'Nothing yet', data: { spins: [] } },
]);
