import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'notebook',
  name: 'Notebook',
  blurb: 'Notes from the back booth',
  targets: [],
  order: 5,
  route: '/notebook',
  sleeve: { src: './sleeve.svg' },
  hydrate: 'none',
  // On the wall as a sleeve with a "being built" page, in local, sandbox and preview builds.
  draft: true,
});
