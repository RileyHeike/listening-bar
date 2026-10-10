import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'site-header',
  name: 'Header',
  targets: ['layout:header'],
  hydrate: 'load',
});
