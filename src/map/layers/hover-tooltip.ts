// ============================================================
// Phase 3: Pilot Hover Tooltip
// Compact tooltip on mouse hover over aircraft
// Shows: Callsign, Aircraft, Alt, Speed, Dep→Arr, Experience, LIVE
// Disabled on touch devices
// ============================================================

import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';
import type { PilotGeoJsonProperties } from '@/data/pilot-pipeline';

// ---- Configuration ----

const AIRCRAFT_LAYER_ID = 'aircraft-layer';

// ---- State ----

let popup: maplibregl.Popup | null = null;
let isTouch = false;

// ---- Experience Colors ----

const EXP_COLORS: Record<string, string> = {
  beginner: '#22c55e',
  intermediate: '#3b82f6',
  advanced: '#a855f7',
  expert: '#eab308',
  master: '#06b6d4',
};

const EXP_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
  master: 'Master',
};

// ---- Initialization ----

/**
 * Attach hover tooltip behavior to the aircraft layer.
 * Only active on non-touch devices.
 */
export function initHoverTooltip(map: MaplibreMap): void {
  // Detect touch device
  isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouch) {
    console.log('[Tooltip] Touch device detected — hover tooltips disabled');
    return;
  }

  // Create reusable popup
  popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
    className: 'pilot-tooltip',
    maxWidth: '280px',
    offset: [0, -15],
  });

  // Inject dark glass styles for MapLibre popups
  if (!document.getElementById('tooltip-styles')) {
    const style = document.createElement('style');
    style.id = 'tooltip-styles';
    style.textContent = `
      .pilot-tooltip .maplibregl-popup-content {
        background: rgba(15, 19, 41, 0.92) !important;
        backdrop-filter: blur(20px) !important;
        -webkit-backdrop-filter: blur(20px) !important;
        border: 1px solid rgba(99, 132, 255, 0.18) !important;
        border-radius: 12px !important;
        padding: 10px 14px !important;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5) !important;
        color: #e2e8f0 !important;
      }
      .pilot-tooltip .maplibregl-popup-tip {
        border-top-color: rgba(15, 19, 41, 0.92) !important;
        border-bottom-color: rgba(15, 19, 41, 0.92) !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ---- Mouse Enter → Show Tooltip ----
  map.on('mouseenter', AIRCRAFT_LAYER_ID, (e) => {
    if (isTouch || !popup) return;

    const features = (e as any).features;
    if (!features?.length) return;

    const props = features[0].properties as unknown as PilotGeoJsonProperties;
    const coords = (features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];

    // Build tooltip HTML
    const html = buildTooltipHtml(props);

    popup
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  });

  // ---- Mouse Move → Update Position ----
  map.on('mousemove', AIRCRAFT_LAYER_ID, (e) => {
    if (!popup || isTouch) return;

    const features = (e as any).features;
    if (!features?.length) return;

    const props = features[0].properties as unknown as PilotGeoJsonProperties;
    const coords = (features[0].geometry as GeoJSON.Point).coordinates.slice() as [number, number];

    popup
      .setLngLat(coords)
      .setHTML(buildTooltipHtml(props));
  });

  // ---- Mouse Leave → Hide Tooltip ----
  map.on('mouseleave', AIRCRAFT_LAYER_ID, () => {
    if (popup) popup.remove();
  });

  console.log('[Tooltip] Hover tooltip initialized');
}

// ---- Tooltip HTML ----

function buildTooltipHtml(props: PilotGeoJsonProperties): string {
  const expColor = EXP_COLORS[props.experienceLevel] ?? '#6b7280';
  const expLabel = EXP_LABELS[props.experienceLevel] ?? '';
  const alt = formatAlt(props.altitude);
  const spd = props.groundspeed > 0 ? `${props.groundspeed} kts` : 'GND';
  const dep = props.departure || '????';
  const arr = props.arrival || '????';
  const type = props.aircraftType || '???';
  const live = props.isStreaming;

  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;padding:2px 0;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
        <span style="font-size:14px;font-weight:800;color:#fff;letter-spacing:0.5px;">${props.callsign}</span>
        ${live ? '<span style="font-size:9px;font-weight:700;color:#ef4444;background:rgba(239,68,68,0.15);padding:1px 5px;border-radius:4px;">LIVE</span>' : ''}
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">
        ${type}
        <span style="margin-left:6px;color:${expColor};font-weight:600;">${expLabel}</span>
      </div>
      <div style="display:flex;align-items:center;gap:4px;font-size:12px;color:#e2e8f0;font-weight:600;margin-bottom:4px;">
        <span>${dep}</span>
        <span style="color:#5a6380;">→</span>
        <span>${arr}</span>
      </div>
      <div style="display:flex;gap:12px;font-size:11px;color:#8892b0;">
        <span>${alt}</span>
        <span>${spd}</span>
        <span>${props.heading.toString().padStart(3, '0')}°</span>
      </div>
    </div>
  `;
}

function formatAlt(alt: number): string {
  if (alt >= 18000) return `FL${Math.round(alt / 100)}`;
  if (alt > 0) return `${alt.toLocaleString()} ft`;
  return 'GND';
}

// ---- Cleanup ----

export function removeHoverTooltip(): void {
  if (popup) {
    popup.remove();
    popup = null;
  }
}
