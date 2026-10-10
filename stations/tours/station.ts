import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'tours',
  name: 'Tours',
  blurb: 'Places the records took me',
  targets: [],
  order: 4,
  route: '/tours',
  sleeve: { src: './sleeve.svg' },
  hydrate: 'none',
  // On the wall as a sleeve with a "being built" page, in local, sandbox and preview builds.
  draft: true,
});
