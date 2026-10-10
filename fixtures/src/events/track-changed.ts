import { defineFixtures } from '../define.ts';

export default defineFixtures('track.changed', [
  {
    label: 'Side A, track 2',
    data: {
      source: 'Turntable',
      title: '[Track title]',
      artist: '[Artist]',
      year: 1959,
      side: 'A',
      track: 2,
    },
  },
  {
    label: 'Side B, track 1',
    data: {
      source: 'Turntable',
      title: '[Another track]',
      artist: '[Quartet]',
      year: 1964,
      side: 'B',
      track: 1,
    },
  },
  {
    label: 'Streaming, minimal',
    data: { source: '[Streaming]', title: '[Late set]', artist: '[Trio]' },
  },
]);
