import type { StationContext } from '@bar/core';
import { sleeveTransitionName } from '@bar/core';

/** A realistic StationContext for rendering station shells in tests. */
export function stationContext(overrides: Partial<StationContext> = {}): StationContext {
  return {
    pageId: 'room',
    path: '/',
    params: {},
    site: {
      name: '[BAR NAME]',
      env: 'local',
      timeZone: 'America/Los_Angeles',
      defaultPhase: 'evening',
      nav: [
        { id: 'workshop-featured', name: 'Workshop', route: '/workshop' },
        { id: 'liner-intro', name: 'Liner Notes', route: '/liner-notes' },
      ],
      wall: [
        {
          id: 'workshop-featured',
          name: 'Workshop',
          blurb: 'Things on the bench',
          route: '/workshop',
          sleeveUrl: '/sleeve-workshop.svg',
          draft: false,
          transitionName: sleeveTransitionName('workshop-featured'),
        },
        {
          id: 'crate',
          name: 'Crate',
          blurb: 'Records worth digging for',
          route: '/crate',
          sleeveUrl: '/sleeve-crate.svg',
          draft: true,
          transitionName: sleeveTransitionName('crate'),
        },
      ],
    },
    ...overrides,
  };
}
