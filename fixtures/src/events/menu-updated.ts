import { defineFixtures } from '../define.ts';

export default defineFixtures('menu.updated', [
  {
    label: "Tonight's menu",
    data: {
      onRotation: '[A record]',
      reading: '[A book]',
      growing: '[A plant]',
      learning: '[A skill]',
      building: '[A project]',
      drinking: '[A drink]',
    },
  },
  {
    label: 'Alternate menu',
    data: {
      onRotation: '[Another record]',
      reading: '[Another book]',
      growing: '[Cuttings]',
      learning: '[Something new]',
      building: '[Something else]',
      drinking: '[Hojicha]',
    },
  },
]);
