import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'discography',
  name: 'Discography',
  targets: ['liner-notes:discography'],
  hydrate: 'none',
});
