// ============================================================
// Phase 17: Search Bar & Toolbar
// Search (Ctrl+K), layer toggles, settings button
// ============================================================

import type { Map as MaplibreMap } from 'maplibre-gl';
import type { MapEngine } from '@/map/engine';
import { getState } from '@/data/vatsim-api';
import { toggleRadar, toggleSigmets, toggleRadarAnimation, isRadarAnimating } from '@/map/layers/weather';
import { toggleSettings } from './settings-panel';

// ---- Search Bar ----

/**
 * Create the search bar component (top center).
 */
export function createSearchBar(
  container: HTMLElement,
  onSelectPilot: (callsign: string) => void,
  onSelectAirport: (icao: string) => void,
): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'absolute top-4 left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-[320px] max-w-[calc(100vw-200px)]';

  wrapper.innerHTML = `
    <div class="relative">
      <input id="search-input" type="text"
             placeholder="Search pilot or airport... (Ctrl+K)"
             class="w-full glass-panel px-4 py-2.5 pr-10
                    text-sm text-white placeholder:text-[var(--color-text-muted)]
                    border-none focus:ring-1 focus:ring-[var(--color-accent)] focus:outline-none" />
      <div class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>
    </div>
    <div id="search-results" class="absolute top-full mt-1 w-full glass-panel max-h-[300px] overflow-y-auto hidden"></div>
  `;

  container.appendChild(wrapper);

  const input = wrapper.querySelector('#search-input') as HTMLInputElement;
  const results = wrapper.querySelector('#search-results') as HTMLElement;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  input.addEventListener('input', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const query = input.value.trim().toUpperCase();
      if (query.length < 2) {
        results.classList.add('hidden');
        return;
      }
      showSearchResults(results, query, onSelectPilot, onSelectAirport, input);
    }, 200);
  });

  input.addEventListener('focus', () => {
    if (input.value.length >= 2) {
      const query = input.value.trim().toUpperCase();
      showSearchResults(results, query, onSelectPilot, onSelectAirport, input);
    }
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target as Node)) {
      results.classList.add('hidden');
    }
  });

  // Keyboard shortcut Ctrl+K
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      input.focus();
      input.select();
    }
  });
}

function showSearchResults(
  container: HTMLElement,
  query: string,
  onSelectPilot: (callsign: string) => void,
  onSelectAirport: (icao: string) => void,
  input: HTMLInputElement,
): void {
  const state = getState();

  // Search pilots
  const pilots = state.pilots
    .filter(p => p.callsign.toUpperCase().includes(query) || String(p.cid).includes(query))
    .slice(0, 8);

  // Search airports (from flight plans)
  const airports = new Set<string>();
  for (const p of state.pilots) {
    if (p.flight_plan?.departure?.toUpperCase().includes(query)) airports.add(p.flight_plan.departure);
    if (p.flight_plan?.arrival?.toUpperCase().includes(query)) airports.add(p.flight_plan.arrival);
    if (airports.size >= 5) break;
  }

  if (pilots.length === 0 && airports.size === 0) {
    container.innerHTML = '<div class="p-3 text-sm text-[var(--color-text-muted)]">No results</div>';
    container.classList.remove('hidden');
    return;
  }

  let html = '';

  if (pilots.length > 0) {
    html += '<div class="px-3 py-1.5 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">Pilots</div>';
    for (const p of pilots) {
      const dep = p.flight_plan?.departure || '????';
      const arr = p.flight_plan?.arrival || '????';
      html += `
        <button class="search-result-pilot w-full text-left px-3 py-2 hover:bg-white/5 flex items-center justify-between cursor-pointer transition-colors"
                data-callsign="${p.callsign}">
          <div>
            <span class="text-sm text-white font-medium">${p.callsign}</span>
            <span class="text-xs text-[var(--color-text-muted)] ml-2">${p.flight_plan?.aircraft_short || ''}</span>
          </div>
          <span class="text-xs text-[var(--color-text-secondary)]">${dep} → ${arr}</span>
        </button>
      `;
    }
  }

  if (airports.size > 0) {
    html += '<div class="px-3 py-1.5 text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider border-t border-[var(--color-border)]">Airports</div>';
    for (const icao of airports) {
      html += `
        <button class="search-result-airport w-full text-left px-3 py-2 hover:bg-white/5 flex items-center cursor-pointer transition-colors"
                data-icao="${icao}">
          <span class="text-sm text-white font-medium">${icao}</span>
        </button>
      `;
    }
  }

  container.innerHTML = html;
  container.classList.remove('hidden');

  // Attach click handlers
  container.querySelectorAll('.search-result-pilot').forEach(el => {
    el.addEventListener('click', () => {
      const callsign = (el as HTMLElement).dataset.callsign!;
      onSelectPilot(callsign);
      container.classList.add('hidden');
      input.value = callsign;
      input.blur();
    });
  });

  container.querySelectorAll('.search-result-airport').forEach(el => {
    el.addEventListener('click', () => {
      const icao = (el as HTMLElement).dataset.icao!;
      onSelectAirport(icao);
      container.classList.add('hidden');
      input.value = icao;
      input.blur();
    });
  });
}

// ---- Layer Toolbar ----

/**
 * Create the layer toggle toolbar (left side).
 */
export function createToolbar(container: HTMLElement, map: MaplibreMap, _engine: MapEngine): void {
  const toolbar = document.createElement('div');
  toolbar.className = 'absolute top-4 left-4 flex flex-col gap-2 z-10 pointer-events-auto';

  // Settings button
  toolbar.appendChild(createToolbarButton('Settings', settingsIcon(), () => {
    toggleSettings(container);
  }));

  // Separator
  toolbar.appendChild(createSeparator());

  // Radar toggle
  toolbar.appendChild(createToolbarButton('Precipitation Radar', radarIcon(), () => {
    toggleRadar(map);
  }, 'btn-radar'));

  // SIGMET toggle
  toolbar.appendChild(createToolbarButton('SIGMETs / AIRMETs', sigmetIcon(), () => {
    toggleSigmets(map);
  }, 'btn-sigmet'));

  // Radar animation
  toolbar.appendChild(createToolbarButton('Animate Radar', playIcon(), () => {
    toggleRadarAnimation(map);
    const btn = document.getElementById('btn-animate');
    if (btn) btn.innerHTML = isRadarAnimating() ? pauseIcon() : playIcon();
  }, 'btn-animate'));

  container.appendChild(toolbar);
}

function createToolbarButton(title: string, icon: string, onClick: () => void, id?: string): HTMLElement {
  const btn = document.createElement('button');
  if (id) btn.id = id;
  btn.title = title;
  btn.innerHTML = icon;
  btn.className = [
    'w-10 h-10 rounded-lg flex items-center justify-center',
    'bg-[var(--color-bg-secondary)] border border-[var(--color-border)]',
    'hover:border-[var(--color-accent)] transition-all cursor-pointer',
    'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
  ].join(' ');
  btn.addEventListener('click', onClick);
  return btn;
}

function createSeparator(): HTMLElement {
  const sep = document.createElement('div');
  sep.className = 'h-px w-8 mx-auto bg-[var(--color-border)]';
  return sep;
}

// ---- Update Status Bar ----

/**
 * Update the status bar with current counts.
 */
export function updateStatusBar(): void {
  const state = getState();

  const pilotsEl = document.getElementById('status-pilots');
  const controllersEl = document.getElementById('status-controllers');
  const updateEl = document.getElementById('status-update');

  if (pilotsEl) pilotsEl.textContent = `${state.pilots.length} Pilots`;
  if (controllersEl) controllersEl.textContent = `${state.controllers.length} Controllers`;
  if (updateEl && state.updateTimestamp) {
    const time = new Date(state.updateTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    updateEl.textContent = `Last update: ${time}`;
  }
}

// ---- Toolbar Icons ----

function settingsIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>`;
}

function radarIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/>
    <path d="M4 6h.01"/>
    <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/>
    <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/>
    <path d="M12 18h.01"/>
    <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/>
    <circle cx="12" cy="12" r="2"/>
    <path d="m13.41 10.59 5.66-5.66"/>
  </svg>`;
}

function sigmetIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>`;
}

function playIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="6,3 20,12 6,21"/>
  </svg>`;
}

function pauseIcon(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/>
  </svg>`;
}
