import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'contact-form',
  name: 'Contact',
  targets: ['liner-notes:contact'],
  hydrate: 'visible',
});
