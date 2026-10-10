import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'house-band',
  name: 'House Band',
  blurb: 'The people who play here',
  targets: [],
  order: 6,
  route: '/house-band',
  sleeve: { src: './sleeve.svg' },
  hydrate: 'none',
  // On the wall as a sleeve with a "being built" page, in local, sandbox and preview builds.
  draft: true,
});
