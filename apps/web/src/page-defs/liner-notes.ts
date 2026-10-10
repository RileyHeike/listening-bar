import { definePage } from '@bar/core';

export default definePage({
  id: 'liner-notes',
  route: '/liner-notes',
  title: 'Liner Notes',
  tone: 'paper',
  slots: ['intro', 'discography', 'contact'],
});
