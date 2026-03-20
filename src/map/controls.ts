// ============================================================
// Phase 10: Custom Map Controls
// Globe toggle, fullscreen, geolocation buttons
// ============================================================

import type { MapEngine } from './engine';

/**
 * Create and attach custom control buttons to the map container.
 */
export function attachCustomControls(engine: MapEngine): void {
  const container = engine.map.getContainer();

  // Create control panel
  const panel = document.createElement('div');
  panel.className = 'absolute top-4 right-4 flex flex-col gap-2 z-10 pointer-events-auto';

  // Globe toggle
  panel.appendChild(createControlButton({
    id: 'btn-globe',
    title: 'Toggle Globe / 2D',
    icon: globeIcon(),
    onClick: () => {
      engine.toggleGlobe();
      const btn = document.getElementById('btn-globe');
      if (btn) {
        btn.classList.toggle('bg-[var(--color-accent)]', engine.isGlobe());
        btn.classList.toggle('bg-[var(--color-bg-secondary)]', !engine.isGlobe());
      }
    },
    active: engine.isGlobe(),
  }));

  // Fullscreen toggle
  panel.appendChild(createControlButton({
    id: 'btn-fullscreen',
    title: 'Fullscreen',
    icon: fullscreenIcon(),
    onClick: () => engine.toggleFullscreen(),
  }));

  // Geolocation
  panel.appendChild(createControlButton({
    id: 'btn-locate',
    title: 'My Location',
    icon: locateIcon(),
    onClick: () => {
      navigator.geolocation?.getCurrentPosition(
        (pos) => engine.flyTo(pos.coords.longitude, pos.coords.latitude, 8),
        () => console.warn('[Controls] Geolocation denied'),
      );
    },
  }));

  // Reset view (Europe)
  panel.appendChild(createControlButton({
    id: 'btn-reset',
    title: 'Reset View',
    icon: resetIcon(),
    onClick: () => engine.flyTo(10, 48, 4),
  }));

  const overlay = container.querySelector('#ui-overlay') ?? container.parentElement?.querySelector('#ui-overlay');
  if (overlay) {
    overlay.appendChild(panel);
  } else {
    container.appendChild(panel);
  }
}

// ---- Button Factory ----

function createControlButton(opts: {
  id: string;
  title: string;
  icon: string;
  onClick: () => void;
  active?: boolean;
}): HTMLElement {
  const btn = document.createElement('button');
  btn.id = opts.id;
  btn.title = opts.title;
  btn.innerHTML = opts.icon;
  btn.className = [
    'w-10 h-10 rounded-lg flex items-center justify-center',
    'pointer-events-auto cursor-pointer',
    'border border-[var(--color-border)]',
    'hover:border-[var(--color-accent)] transition-all duration-200',
    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
    opts.active ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-secondary)]',
  ].join(' ');
  btn.addEventListener('click', opts.onClick);
  return btn;
}

// ---- SVG Icons (inline, 20x20) ----

function globeIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>`;
}

function fullscreenIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
  </svg>`;
}

function locateIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
  </svg>`;
}

function resetIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
    <path d="M3 3v5h5"/>
  </svg>`;
}
