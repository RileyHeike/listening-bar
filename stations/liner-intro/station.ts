import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'liner-intro',
  name: 'Liner Notes',
  blurb: 'The professional side',
  targets: ['liner-notes:intro'],
  order: 2,
  route: '/liner-notes',
  sleeve: { src: './sleeve.svg' },
  hydrate: 'visible',
});
