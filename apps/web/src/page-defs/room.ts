import { definePage } from '@bar/core';

export default definePage({
  id: 'room',
  route: '/',
  title: 'The room',
  tone: 'room',
  slots: ['entrance', 'counter', 'hifi', 'wall', 'menu', 'window'],
});
