// ============================================================
// Aircraft Rendering Layer — REDESIGNED
// NO clustering — ALL aircraft always visible at every zoom
// GeoJSON source, Symbol layer, smooth interpolation
// ============================================================

import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { PilotGeoJsonCollection, PilotGeoJsonProperties } from '@/data/pilot-pipeline';
import { registerAircraftIcons, getIconSizeExpression } from './aircraft-icons';

// ---- Configuration ----

const SOURCE_ID = 'aircraft-source';
const LAYER_ID = 'aircraft-layer';
const LABEL_LAYER_ID = 'aircraft-labels';
const LABEL_MIN_ZOOM = 7;
const INTERPOLATION_DURATION_MS = 15_000;

// ---- Types ----

export type AircraftClickCallback = (properties: PilotGeoJsonProperties, lngLat: [number, number]) => void;

// ---- State ----

let interpolationFrame: number | null = null;
let clickCallback: AircraftClickCallback | null = null;

// ---- Initialization ----

/**
 * Initialize the aircraft rendering layer on the map.
 * NO clustering — all aircraft visible at ALL zoom levels.
 */
export function initAircraftLayer(map: MaplibreMap): void {
  // Register all aircraft icon variants
  registerAircraftIcons(map);

  // GeoJSON source — NO clustering
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // ---- Aircraft Symbol Layer — ALWAYS VISIBLE ----
  map.addLayer({
    id: LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      // Dynamic icon based on aircraft category + phase + streaming
      'icon-image': [
        'case',
        ['get', 'isStreaming'],
        ['concat', 'aircraft-', ['get', 'aircraftCategory'], '-streaming'],
        ['concat', 'aircraft-', ['get', 'aircraftCategory'], '-', ['get', 'flightPhase']],
      ],
      'icon-size': getIconSizeExpression(),
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-pitch-alignment': 'map',
    },
  });

  // ---- Callsign Labels (shown at higher zoom) ----
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: LABEL_MIN_ZOOM,
    layout: {
      'text-field': ['get', 'callsign'],
      'text-font': ['Open Sans Regular'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        7, 8,
        10, 9,
        14, 10,
      ],
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': [
        'case',
        ['get', 'isStreaming'],
        '#ef4444',
        '#8892b0',
      ],
      'text-halo-color': 'rgba(10, 14, 39, 0.9)',
      'text-halo-width': 1.5,
    },
  });

  // ---- Click Handler ----
  map.on('click', LAYER_ID, (e) => {
    const features = (e as any).features;
    if (!features?.length || !clickCallback) return;
    const feature = features[0];
    const props = feature.properties as unknown as PilotGeoJsonProperties;
    const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    clickCallback(props, lngLat);
  });

  // ---- Cursor ----
  map.on('mouseenter', LAYER_ID, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', LAYER_ID, () => {
    map.getCanvas().style.cursor = '';
  });

  console.log('[Aircraft Layer] Initialized — no clustering, all aircraft visible');
}

// ---- Data Updates ----

/**
 * Update the aircraft layer with new pilot data.
 */
export function updateAircraftData(map: MaplibreMap, geojson: PilotGeoJsonCollection): void {
  const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
  if (source) {
    source.setData(geojson);
  }
  // Notify interpolation timer
  (globalThis as any).__aircraftUpdateHook?.();
}

// ---- Smooth Interpolation ----

/**
 * Start smooth position interpolation between API updates.
 */
export function startInterpolation(
  map: MaplibreMap,
  getCurrentGeoJson: () => PilotGeoJsonCollection | null,
  getPreviousPositions: () => Map<number, { lat: number; lng: number; heading: number }>,
): void {
  let lastUpdateTime = Date.now();

  (globalThis as any).__aircraftUpdateHook = () => {
    lastUpdateTime = Date.now();
  };

  function animate() {
    const now = Date.now();
    const progress = Math.min((now - lastUpdateTime) / INTERPOLATION_DURATION_MS, 1);

    const current = getCurrentGeoJson();
    if (!current) {
      interpolationFrame = requestAnimationFrame(animate);
      return;
    }

    const prevPositions = getPreviousPositions();

    const interpolated: PilotGeoJsonCollection = {
      type: 'FeatureCollection',
      features: current.features.map(feature => {
        const cid = feature.properties.cid;
        const prev = prevPositions.get(cid);

        if (!prev || progress >= 1) return feature;

        const lng = lerp(prev.lng, feature.geometry.coordinates[0], progress);
        const lat = lerp(prev.lat, feature.geometry.coordinates[1], progress);
        const heading = lerpAngle(prev.heading, feature.properties.heading, progress);

        return {
          ...feature,
          geometry: { ...feature.geometry, coordinates: [lng, lat] },
          properties: { ...feature.properties, heading },
        };
      }),
    };

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(interpolated);
    }

    interpolationFrame = requestAnimationFrame(animate);
  }

  interpolationFrame = requestAnimationFrame(animate);
}

/**
 * Stop interpolation loop.
 */
export function stopInterpolation(): void {
  if (interpolationFrame !== null) {
    cancelAnimationFrame(interpolationFrame);
    interpolationFrame = null;
  }
}

// ---- Math Helpers ----

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpAngle(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  return ((a + diff * t) + 360) % 360;
}

// ---- Event Handlers ----

export function onAircraftClick(callback: AircraftClickCallback): void {
  clickCallback = callback;
}

// ---- Visibility ----

export function setAircraftVisible(map: MaplibreMap, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  for (const layerId of [LAYER_ID, LABEL_LAYER_ID]) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
}

// ---- Cleanup ----

export function removeAircraftLayer(map: MaplibreMap): void {
  stopInterpolation();
  for (const layerId of [LABEL_LAYER_ID, LAYER_ID]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export { SOURCE_ID, LAYER_ID };
