import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'workshop-album',
  name: 'Album',
  targets: ['project:album'],
  hydrate: 'none',
});
