import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'chalkboard',
  name: 'Chalkboard',
  targets: ['room:menu'],
  hydrate: 'visible',
  listens: ['menu.updated'],
});
