import { definePage } from '@bar/core';

export default definePage({
  id: 'workshop',
  route: '/workshop',
  title: 'Workshop',
  tone: 'paper',
  slots: ['header', 'featured', 'shelf'],
});
