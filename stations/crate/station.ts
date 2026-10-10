import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'crate',
  name: 'Crate',
  blurb: 'Records worth digging for',
  targets: [],
  order: 3,
  route: '/crate',
  sleeve: { src: './sleeve.svg' },
  hydrate: 'none',
  // On the wall as a sleeve with a "being built" page, in local, sandbox and preview builds.
  draft: true,
});
