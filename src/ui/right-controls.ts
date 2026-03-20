// ============================================================
// Phase 1.2: Right Controls
// Globe toggle, Fullscreen, Geolocation, Reset View
// ============================================================

import type { Map as MaplibreMap } from 'maplibre-gl';

// ---- State ----

let isGlobe = false;

// ---- Create Controls ----

export function createRightControls(map: MaplibreMap, overlay: HTMLElement): void {
  const panel = document.createElement('div');
  panel.id = 'right-controls';
  Object.assign(panel.style, {
    position: 'absolute', top: '12px', right: '12px',
    display: 'flex', flexDirection: 'column', gap: '6px',
    zIndex: '15', pointerEvents: 'auto',
  });

  // Globe / 2D toggle
  panel.appendChild(ctrlBtn('ctrl-globe', 'Toggle Globe / 2D', globeIcon(), () => {
    isGlobe = !isGlobe;
    try {
      map.setProjection({ type: isGlobe ? 'globe' : 'mercator' });
    } catch { /* Globe not supported with raster tiles */ }
    updateCtrl('ctrl-globe', isGlobe);
  }));

  // Fullscreen
  panel.appendChild(ctrlBtn('ctrl-fullscreen', 'Fullscreen', fullscreenIcon(), () => {
    const el = map.getContainer().parentElement ?? map.getContainer();
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }));

  // My Location
  panel.appendChild(ctrlBtn('ctrl-locate', 'My Location', locateIcon(), () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 8, duration: 1500 }),
      () => console.warn('[Controls] Geolocation denied'),
    );
  }));

  // Reset View (Europe, zoom 5)
  panel.appendChild(ctrlBtn('ctrl-reset', 'Reset View', resetIcon(), () => {
    map.flyTo({ center: [8.5, 47.4], zoom: 5, duration: 1500 });
  }));

  overlay.appendChild(panel);
}

// ---- Button Factory ----

function ctrlBtn(id: string, title: string, icon: string, onClick: () => void): HTMLElement {
  const btn = document.createElement('button');
  btn.id = id;
  btn.title = title;
  btn.innerHTML = icon;
  Object.assign(btn.style, {
    width: '38px', height: '38px', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 0.2s',
    border: '1px solid rgba(99,132,255,0.12)',
    background: 'rgba(15,19,41,0.9)',
    color: '#5a6380',
  });
  btn.addEventListener('click', onClick);
  btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(79,140,255,0.3)'; btn.style.color = '#94a3b8'; });
  btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(99,132,255,0.12)'; btn.style.color = '#5a6380'; });
  return btn;
}

function updateCtrl(id: string, active: boolean): void {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.style.background = active ? 'rgba(79,140,255,0.15)' : 'rgba(15,19,41,0.9)';
  btn.style.color = active ? '#4f8cff' : '#5a6380';
}

// ---- SVG Icons ----

function globeIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
}

function fullscreenIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
}

function locateIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>`;
}

function resetIcon(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
}
