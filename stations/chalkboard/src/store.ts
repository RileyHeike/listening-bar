import type { EventData } from '@bar/core';
import { createRoomStore } from '@bar/room';

export type Menu = EventData<'menu.updated'>;

/** Tonight's menu from live events; null until one arrives. */
export const $menu = createRoomStore<Menu | null>(null, {
  'menu.updated': (_, envelope) => envelope.data,
});
