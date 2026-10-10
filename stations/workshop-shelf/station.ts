import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'workshop-shelf',
  name: 'Shelf',
  targets: ['workshop:shelf'],
  hydrate: 'visible',
});
