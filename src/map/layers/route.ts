// ============================================================
// Phase 2: Route Line Layer
// Shows flight route on map when pilot is selected
// Dep marker → flown path → current position → dashed future → Arr marker
// ============================================================

import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { EnrichedPilot } from '@/types';
import { getAirportCoords } from '@/data/airports-db';

// ---- Layer IDs ----

const ROUTE_SOURCE = 'route-source';
const ROUTE_FLOWN_LAYER = 'route-flown';        // Solid line (already flown)
const ROUTE_FUTURE_LAYER = 'route-future';       // Dashed line (remaining)
const MARKERS_SOURCE = 'route-markers-source';
const MARKERS_LAYER = 'route-markers';
const MARKERS_LABEL_LAYER = 'route-markers-labels';

// ---- State ----

let isInitialized = false;
let currentPilotCid: number | null = null;

// ---- Initialization ----

/**
 * Initialize route line layers on the map.
 * Should be called AFTER aircraft layers are added.
 */
export function initRouteLayer(map: MaplibreMap): void {
  // Route line source (two features: flown + future)
  map.addSource(ROUTE_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // Markers source (dep + arr points)
  map.addSource(MARKERS_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // ---- Flown path (solid line) ----
  map.addLayer({
    id: ROUTE_FLOWN_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['==', ['get', 'segment'], 'flown'],
    paint: {
      'line-color': '#4f8cff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.5, 8, 2.5, 14, 3],
      'line-opacity': 0.7,
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  }, 'aircraft-layer'); // Below aircraft icons

  // ---- Future path (dashed line) ----
  map.addLayer({
    id: ROUTE_FUTURE_LAYER,
    type: 'line',
    source: ROUTE_SOURCE,
    filter: ['==', ['get', 'segment'], 'future'],
    paint: {
      'line-color': '#4f8cff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 8, 2, 14, 2.5],
      'line-opacity': 0.35,
      'line-dasharray': [4, 4],
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
  }, 'aircraft-layer');

  // ---- Dep/Arr marker dots ----
  map.addLayer({
    id: MARKERS_LAYER,
    type: 'circle',
    source: MARKERS_SOURCE,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 6, 14, 8],
      'circle-color': ['match', ['get', 'type'],
        'departure', '#22c55e',   // Green
        'arrival', '#ef4444',     // Red
        '#4f8cff',
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#0f1329',
    },
  }, 'aircraft-layer');

  // ---- Dep/Arr ICAO labels ----
  map.addLayer({
    id: MARKERS_LABEL_LAYER,
    type: 'symbol',
    source: MARKERS_SOURCE,
    layout: {
      'text-field': ['get', 'icao'],
      'text-font': ['Open Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 12, 14, 14],
      'text-offset': [0, -1.5],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': ['match', ['get', 'type'],
        'departure', '#22c55e',
        'arrival', '#ef4444',
        '#4f8cff',
      ],
      'text-halo-color': 'rgba(15,19,41,0.95)',
      'text-halo-width': 2,
    },
  }, 'aircraft-layer');

  isInitialized = true;
  console.log('[Route] Layer initialized');
}

// ---- Show Route ----

/**
 * Show the route for a selected pilot on the map.
 * Creates: departure marker → solid flown line → dashed future → arrival marker
 */
export function showRoute(map: MaplibreMap, pilot: EnrichedPilot): void {
  if (!isInitialized) return;

  const dep = pilot.flightPlan?.departure;
  const arr = pilot.flightPlan?.arrival;
  if (!dep || !arr) {
    clearRoute(map);
    return;
  }

  const depCoords = getAirportCoords(dep);
  const arrCoords = getAirportCoords(arr);
  if (!depCoords || !arrCoords) {
    clearRoute(map);
    return;
  }

  currentPilotCid = pilot.cid;
  const pilotPos: [number, number] = [pilot.longitude, pilot.latitude];

  // ---- Build route lines ----
  const routeFeatures: GeoJSON.Feature[] = [
    // Flown segment: departure → current position
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [depCoords, pilotPos],
      },
      properties: { segment: 'flown' },
    },
    // Future segment: current position → arrival
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [pilotPos, arrCoords],
      },
      properties: { segment: 'future' },
    },
  ];

  const routeSource = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
  if (routeSource) {
    routeSource.setData({ type: 'FeatureCollection', features: routeFeatures });
  }

  // ---- Build markers ----
  const markerFeatures: GeoJSON.Feature[] = [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: depCoords },
      properties: { type: 'departure', icao: dep },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: arrCoords },
      properties: { type: 'arrival', icao: arr },
    },
  ];

  const markerSource = map.getSource(MARKERS_SOURCE) as GeoJSONSource | undefined;
  if (markerSource) {
    markerSource.setData({ type: 'FeatureCollection', features: markerFeatures });
  }
}

/**
 * Update the route for the currently selected pilot (called on data refresh).
 * Only updates if the same pilot is still selected.
 */
export function updateRoute(map: MaplibreMap, pilot: EnrichedPilot): void {
  if (currentPilotCid !== pilot.cid) return;
  showRoute(map, pilot);
}

// ---- Clear Route ----

/**
 * Remove the route from the map.
 */
export function clearRoute(map: MaplibreMap): void {
  currentPilotCid = null;

  const routeSource = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
  if (routeSource) {
    routeSource.setData({ type: 'FeatureCollection', features: [] });
  }

  const markerSource = map.getSource(MARKERS_SOURCE) as GeoJSONSource | undefined;
  if (markerSource) {
    markerSource.setData({ type: 'FeatureCollection', features: [] });
  }
}

/**
 * Get the CID of the currently route-displayed pilot.
 */
export function getRoutePilotCid(): number | null {
  return currentPilotCid;
}

// ---- Camera ----

/**
 * Fit the camera to show the entire route (dep + arr).
 */
export function fitRouteInView(map: MaplibreMap, pilot: EnrichedPilot): void {
  const dep = pilot.flightPlan?.departure;
  const arr = pilot.flightPlan?.arrival;
  if (!dep || !arr) return;

  const depCoords = getAirportCoords(dep);
  const arrCoords = getAirportCoords(arr);
  if (!depCoords || !arrCoords) return;

  const pilotPos: [number, number] = [pilot.longitude, pilot.latitude];

  // Find bounds
  const lngs = [depCoords[0], arrCoords[0], pilotPos[0]];
  const lats = [depCoords[1], arrCoords[1], pilotPos[1]];
  const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
  const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];

  map.fitBounds([sw, ne], {
    padding: { top: 80, bottom: 80, left: 80, right: 400 }, // Extra right padding for Pilot Card
    duration: 1200,
    maxZoom: 10,
  });
}
