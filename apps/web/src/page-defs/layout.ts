import { defineLayout } from '@bar/core';

/** Site-wide slots, rendered by the base layout on every page. */
export default defineLayout({ slots: ['header', 'footer', 'overlay'] });
