import { defineFixtures } from '../define.ts';

export default defineFixtures('weather.changed', [
  {
    label: 'Rain',
    data: { condition: 'rain', temperatureC: 12, summary: 'Light rain on the glass' },
  },
  { label: 'Clear', data: { condition: 'clear', temperatureC: 21, summary: 'Clear and still' } },
  { label: 'Fog', data: { condition: 'fog', temperatureC: 9 } },
]);
