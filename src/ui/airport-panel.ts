// ============================================================
// Phase 14: Airport Panel & METAR Display
// Shows airport info, decoded METAR, flight rules, controllers
// ============================================================

import type { DecodedMetar, FlightRules, VatsimController, VatsimAtis, VatsimPilot } from '@/types';
import { FLIGHT_RULES_COLORS, CONTROLLER_RATINGS, FACILITY_TYPES } from '@/types';
import { fetchMetar, calculateFlightRules } from '@/data/weather-api';
import { getState, getControllersForAirport, getAtisForAirport } from '@/data/vatsim-api';

// ---- Configuration ----

const PANEL_ID = 'airport-panel';
const PANEL_WIDTH = '380px';

// ---- State ----

let currentPanel: HTMLElement | null = null;
let currentIcao: string | null = null;

// ---- Panel Management ----

/**
 * Show airport info panel for an ICAO code.
 */
export async function showAirportPanel(icao: string, container: HTMLElement): Promise<void> {
  const code = icao.toUpperCase();

  if (currentPanel && currentIcao !== code) {
    closeAirportPanel();
  }

  currentIcao = code;

  if (!currentPanel) {
    currentPanel = createPanel(container);
  }

  // Show loading state
  currentPanel.innerHTML = renderLoading(code);
  animateIn(currentPanel);

  // Fetch data
  const [metar, controllers, atis, traffic] = await Promise.all([
    fetchMetar(code),
    Promise.resolve(getControllersForAirport(code)),
    Promise.resolve(getAtisForAirport(code)),
    Promise.resolve(getTrafficForAirport(code)),
  ]);

  // Calculate flight rules
  let flightRules: FlightRules = 'VFR';
  if (metar) {
    flightRules = calculateFlightRules(metar.visibility.statute, metar.ceiling);
  }

  // Update panel with full data
  if (currentPanel && currentIcao === code) {
    currentPanel.innerHTML = renderAirportContent(code, metar, flightRules, controllers, atis, traffic);
    attachCloseHandler(currentPanel);
  }
}

/**
 * Close the airport panel.
 */
export function closeAirportPanel(): void {
  if (!currentPanel) return;

  currentPanel.classList.remove('panel-active');
  currentPanel.classList.add('panel-exit');

  const panel = currentPanel;
  setTimeout(() => panel.remove(), 300);

  currentPanel = null;
  currentIcao = null;
}

export function isAirportPanelOpen(): boolean {
  return currentPanel !== null;
}

// ---- Traffic Helpers ----

function getTrafficForAirport(icao: string): { arrivals: VatsimPilot[]; departures: VatsimPilot[]; ground: VatsimPilot[] } {
  const state = getState();
  const code = icao.toUpperCase();

  const arrivals: VatsimPilot[] = [];
  const departures: VatsimPilot[] = [];
  const ground: VatsimPilot[] = [];

  for (const pilot of state.pilots) {
    if (!pilot.flight_plan) continue;

    if (pilot.flight_plan.arrival === code) {
      if (pilot.groundspeed < 40 && pilot.altitude < 500) {
        ground.push(pilot);
      } else {
        arrivals.push(pilot);
      }
    } else if (pilot.flight_plan.departure === code) {
      if (pilot.groundspeed < 40 && pilot.altitude < 500) {
        ground.push(pilot);
      } else {
        departures.push(pilot);
      }
    }
  }

  return { arrivals, departures, ground };
}

// ---- Panel Structure ----

function createPanel(container: HTMLElement): HTMLElement {
  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.className = [
    'absolute top-4 right-16 bottom-4',
    'glass-panel overflow-y-auto overflow-x-hidden',
    'pointer-events-auto panel-enter',
    'flex flex-col',
  ].join(' ');
  panel.style.width = PANEL_WIDTH;
  panel.style.maxWidth = 'calc(100vw - 80px)';

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAirportPanel();
  }, { once: true });

  container.appendChild(panel);
  return panel;
}

function animateIn(panel: HTMLElement): void {
  requestAnimationFrame(() => {
    panel.classList.remove('panel-enter');
    panel.classList.add('panel-active');
  });
}

function attachCloseHandler(panel: HTMLElement): void {
  panel.querySelector('#airport-panel-close')?.addEventListener('click', closeAirportPanel);
}

// ---- Renderers ----

function renderLoading(icao: string): string {
  return `
    <div class="p-5">
      <h2 class="text-xl font-bold text-white">${icao}</h2>
      <div class="mt-4 flex items-center gap-2 text-[var(--color-text-secondary)]">
        <div class="w-4 h-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
        <span class="text-sm">Loading METAR...</span>
      </div>
    </div>
  `;
}

function renderAirportContent(
  icao: string,
  metar: DecodedMetar | null,
  flightRules: FlightRules,
  controllers: VatsimController[],
  atis: VatsimAtis | undefined,
  traffic: { arrivals: VatsimPilot[]; departures: VatsimPilot[]; ground: VatsimPilot[] },
): string {
  const frColor = FLIGHT_RULES_COLORS[flightRules];

  return `
    <!-- Close Button -->
    <button id="airport-panel-close" class="absolute top-3 right-3 w-8 h-8 rounded-lg
      bg-white/5 hover:bg-white/10 flex items-center justify-center
      text-[var(--color-text-secondary)] hover:text-white transition-colors cursor-pointer z-10">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>

    <!-- Header -->
    <div class="p-5 pb-3">
      <div class="flex items-center gap-3">
        <h2 class="text-xl font-bold text-white">${icao}</h2>
        <span class="px-2.5 py-0.5 rounded-full text-xs font-bold"
              style="background: ${frColor}20; color: ${frColor}; border: 1px solid ${frColor}40;">
          ${flightRules}
        </span>
      </div>
      <div class="flex items-center gap-4 mt-2 text-sm text-[var(--color-text-secondary)]">
        <span>${traffic.arrivals.length} arrivals</span>
        <span>${traffic.departures.length} departures</span>
        <span>${traffic.ground.length} on ground</span>
      </div>
    </div>

    <div class="h-px mx-5 bg-[var(--color-border)]"></div>

    <!-- METAR -->
    <div class="p-5">
      ${metar ? renderMetar(metar) : '<div class="text-sm text-[var(--color-text-muted)] italic">No METAR available</div>'}
    </div>

    <div class="h-px mx-5 bg-[var(--color-border)]"></div>

    <!-- ATIS -->
    ${atis ? `
      <div class="p-5">
        ${renderAtis(atis)}
      </div>
      <div class="h-px mx-5 bg-[var(--color-border)]"></div>
    ` : ''}

    <!-- Controllers -->
    <div class="p-5">
      ${renderControllers(controllers)}
    </div>

    <div class="h-px mx-5 bg-[var(--color-border)]"></div>

    <!-- Traffic -->
    <div class="p-5">
      ${renderTraffic(traffic)}
    </div>
  `;
}

function renderMetar(metar: DecodedMetar): string {
  const windDir = metar.wind.variable ? 'VRB' : (metar.wind.direction?.toString().padStart(3, '0') ?? '---');
  const windStr = `${windDir}\u00B0 / ${metar.wind.speed} kts${metar.wind.gust ? ` G${metar.wind.gust}` : ''}`;
  const visStr = metar.visibility.meters >= 9999 ? '10+ km' : `${(metar.visibility.meters / 1000).toFixed(1)} km`;
  const tempStr = `${metar.temperature}\u00B0C / ${metar.dewpoint}\u00B0C`;
  const qnhStr = `${metar.altimeter.hpa} hPa (${metar.altimeter.inhg.toFixed(2)} inHg)`;
  const cloudsStr = metar.clouds.map(c =>
    `${c.coverage}${c.altitude < 99999 ? ` ${Math.round(c.altitude / 100).toString().padStart(3, '0')}` : ''}${c.type ? ` ${c.type}` : ''}`
  ).join(', ') || 'Clear';

  return `
    <div class="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">METAR</div>
    <div class="text-xs font-mono text-[var(--color-text-secondary)] bg-white/5 rounded-lg p-3 mb-3 leading-relaxed break-all">
      ${metar.raw}
    </div>
    <div class="grid grid-cols-2 gap-2">
      ${renderWeatherCell('Wind', windStr)}
      ${renderWeatherCell('Visibility', visStr)}
      ${renderWeatherCell('Temp / Dew', tempStr)}
      ${renderWeatherCell('QNH', qnhStr)}
      ${renderWeatherCell('Clouds', cloudsStr)}
      ${renderWeatherCell('Observed', metar.observationTime || '--')}
    </div>
  `;
}

function renderWeatherCell(label: string, value: string): string {
  return `
    <div class="bg-white/5 rounded-lg px-3 py-2">
      <div class="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">${label}</div>
      <div class="text-xs text-white mt-0.5">${value}</div>
    </div>
  `;
}

function renderAtis(atis: VatsimAtis): string {
  const text = atis.text_atis?.join(' ') || 'No ATIS text';
  return `
    <div class="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
      ATIS ${atis.atis_code ? `\u2014 Information ${atis.atis_code}` : ''}
    </div>
    <div class="text-xs font-mono text-[var(--color-text-secondary)] bg-white/5 rounded-lg p-3 leading-relaxed">
      ${text}
    </div>
  `;
}

function renderControllers(controllers: VatsimController[]): string {
  if (controllers.length === 0) {
    return `
      <div class="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">ATC</div>
      <div class="text-sm text-[var(--color-text-muted)] italic">No controllers online</div>
    `;
  }

  const rows = controllers.map(c => {
    const facility = FACILITY_TYPES[c.facility] ?? 'UNK';
    const rating = CONTROLLER_RATINGS[c.rating]?.short ?? '?';
    return `
      <div class="flex items-center justify-between py-1.5">
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono px-1.5 py-0.5 rounded bg-[var(--color-accent)]/10 text-[var(--color-accent)]">${facility}</span>
          <span class="text-sm text-white">${c.callsign}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-[var(--color-text-muted)]">${rating}</span>
          <span class="text-xs font-mono text-[var(--color-accent)]">${c.frequency}</span>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">ATC (${controllers.length})</div>
    <div class="divide-y divide-[var(--color-border)]">
      ${rows}
    </div>
  `;
}

function renderTraffic(traffic: { arrivals: VatsimPilot[]; departures: VatsimPilot[]; ground: VatsimPilot[] }): string {
  const total = traffic.arrivals.length + traffic.departures.length + traffic.ground.length;
  if (total === 0) {
    return `
      <div class="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Traffic</div>
      <div class="text-sm text-[var(--color-text-muted)] italic">No traffic</div>
    `;
  }

  const renderPilotRow = (p: VatsimPilot, info: string) => `
    <div class="flex items-center justify-between py-1">
      <span class="text-xs font-mono text-white">${p.callsign}</span>
      <span class="text-[10px] text-[var(--color-text-muted)]">${p.flight_plan?.aircraft_short || '?'} \u2014 ${info}</span>
    </div>
  `;

  let html = `<div class="text-xs text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Traffic (${total})</div>`;

  if (traffic.arrivals.length > 0) {
    html += `<div class="text-[10px] text-amber-400 uppercase mt-2 mb-1">Arriving (${traffic.arrivals.length})</div>`;
    html += traffic.arrivals.slice(0, 10).map(p =>
      renderPilotRow(p, `FL${Math.round(p.altitude / 100)} ${p.groundspeed}kts from ${p.flight_plan?.departure || '?'}`)
    ).join('');
    if (traffic.arrivals.length > 10) html += `<div class="text-[10px] text-[var(--color-text-muted)] mt-1">+${traffic.arrivals.length - 10} more</div>`;
  }

  if (traffic.departures.length > 0) {
    html += `<div class="text-[10px] text-cyan-400 uppercase mt-2 mb-1">Departing (${traffic.departures.length})</div>`;
    html += traffic.departures.slice(0, 10).map(p =>
      renderPilotRow(p, `FL${Math.round(p.altitude / 100)} ${p.groundspeed}kts to ${p.flight_plan?.arrival || '?'}`)
    ).join('');
  }

  if (traffic.ground.length > 0) {
    html += `<div class="text-[10px] text-gray-400 uppercase mt-2 mb-1">On Ground (${traffic.ground.length})</div>`;
    html += traffic.ground.slice(0, 5).map(p =>
      renderPilotRow(p, p.flight_plan?.departure === currentIcao ? `to ${p.flight_plan?.arrival || '?'}` : `from ${p.flight_plan?.departure || '?'}`)
    ).join('');
  }

  return html;
}
