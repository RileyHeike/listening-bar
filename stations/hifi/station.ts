import { defineStation } from '@bar/core';

export default defineStation({
  manifestVersion: 1,
  id: 'hifi',
  name: 'Hi-fi',
  targets: ['room:hifi'],
  hydrate: 'visible',
  listens: ['track.changed', 'track.stopped', 'spins.updated'],
});
