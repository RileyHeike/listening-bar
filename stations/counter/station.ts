import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'counter',
  name: 'Counter',
  targets: ['room:counter'],
  order: 0,
  hydrate: 'visible',
});
