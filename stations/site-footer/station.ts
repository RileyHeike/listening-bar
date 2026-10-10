import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'site-footer',
  name: 'Footer',
  targets: ['layout:footer'],
  hydrate: 'none',
});
