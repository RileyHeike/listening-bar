/**
 * Dev-only control panel entry, injected on every page by the dev-tools
 * integration (only for `astro dev`). The panel lives in a shadow root so
 * site styles cannot reach it, and survives client-router navigations.
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { ControlPanel } from './ControlPanel.tsx';
import styles from './panel.css?inline';

export const PANEL_MARKER = 'data-bar-control-panel';

declare global {
  interface Window {
    __barPanelHost?: HTMLElement;
  }
}

function mount(): void {
  if (window.__barPanelHost) {
    // The router swapped <body>; put the existing panel (and its state) back.
    if (!window.__barPanelHost.isConnected) document.body.append(window.__barPanelHost);
    return;
  }
  const host = document.createElement('div');
  host.setAttribute(PANEL_MARKER, '');
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  const container = document.createElement('div');
  shadow.append(style, container);
  document.body.append(host);
  window.__barPanelHost = host;
  createRoot(container).render(createElement(ControlPanel));
}

mount();
document.addEventListener('astro:after-swap', mount);
