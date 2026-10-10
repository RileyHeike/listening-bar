import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'window',
  name: 'Window',
  targets: ['room:window'],
  hydrate: 'visible',
  listens: ['weather.changed'],
});
