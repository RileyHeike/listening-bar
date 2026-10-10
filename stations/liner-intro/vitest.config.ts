/// <reference types="vitest/config" />
import react from '@astrojs/react';
import { getViteConfig } from 'astro/config';

export default getViteConfig({ test: {} }, { configFile: false, integrations: [react()] });
