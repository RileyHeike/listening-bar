import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'record-wall',
  name: 'Record wall',
  targets: ['room:wall'],
  hydrate: 'none',
});
