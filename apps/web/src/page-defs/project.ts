import { definePage } from '@bar/core';

export default definePage({
  id: 'project',
  route: '/workshop/[slug]',
  title: 'Workshop',
  tone: 'paper',
  slots: ['album'],
});
