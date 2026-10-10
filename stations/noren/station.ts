import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'noren',
  name: 'Noren',
  targets: ['room:entrance'],
  hydrate: 'load',
});
