import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'workshop-featured',
  name: 'Workshop',
  blurb: 'Things on the bench',
  targets: ['workshop:featured'],
  order: 1,
  route: '/workshop',
  sleeve: { src: './sleeve.svg' },
  hydrate: 'none',
});
