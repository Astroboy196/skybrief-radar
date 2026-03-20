// ============================================================
// Phase 4: Airport Markers Layer
// Shows ICAO labels for all airports with traffic or ATC
// Color-coded: green = ATC active, white = traffic, gray = no activity
// Dot size scales with traffic volume
// ============================================================

import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { VatsimPilot, VatsimController, VatsimAtis } from '@/types';
import { AIRPORT_COORDS } from '@/data/airports-db';

// ---- Layer IDs ----

const SOURCE = 'airports-source';
const DOT_LAYER = 'airports-dots';
const LABEL_LAYER = 'airports-labels';

// ---- Types ----

interface AirportInfo {
  icao: string;
  coords: [number, number];
  arrivals: number;
  departures: number;
  ground: number;
  hasATC: boolean;
  hasATIS: boolean;
}

// ---- Init ----

export function initAirportLayer(map: MaplibreMap): void {
  map.addSource(SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // Airport dots
  map.addLayer({
    id: DOT_LAYER,
    type: 'circle',
    source: SOURCE,
    minzoom: 5,
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        5, ['case', ['>', ['get', 'traffic'], 5], 4, ['>', ['get', 'traffic'], 0], 3, 2],
        10, ['case', ['>', ['get', 'traffic'], 5], 6, ['>', ['get', 'traffic'], 0], 4.5, 3],
        14, ['case', ['>', ['get', 'traffic'], 5], 8, ['>', ['get', 'traffic'], 0], 6, 4],
      ],
      'circle-color': [
        'case',
        ['get', 'hasATC'], '#22c55e',       // Green for ATC
        ['>', ['get', 'traffic'], 0], '#94a3b8', // Light gray for traffic
        '#3a4260',                            // Dark for no activity
      ],
      'circle-opacity': [
        'case',
        ['get', 'hasATC'], 0.8,
        ['>', ['get', 'traffic'], 0], 0.5,
        0.25,
      ],
      'circle-stroke-width': 1,
      'circle-stroke-color': [
        'case',
        ['get', 'hasATC'], 'rgba(34,197,94,0.3)',
        'rgba(148,163,184,0.15)',
      ],
    },
  }); // Bottom layer

  // ICAO labels
  map.addLayer({
    id: LABEL_LAYER,
    type: 'symbol',
    source: SOURCE,
    minzoom: 8,
    layout: {
      'text-field': ['get', 'icao'],
      'text-font': ['Open Sans Regular'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, 9, 12, 11, 16, 13],
      'text-anchor': 'left',
      'text-offset': [0.8, 0],
      'text-allow-overlap': false,
      'text-optional': true,
      'symbol-sort-key': ['-', ['get', 'traffic']], // Most traffic shown first
    },
    paint: {
      'text-color': [
        'case',
        ['get', 'hasATC'], '#22c55e',
        ['>', ['get', 'traffic'], 0], '#8892b0',
        '#4a5568',
      ],
      'text-halo-color': 'rgba(10,14,39,0.9)',
      'text-halo-width': 1.5,
    },
  }); // Labels on top of dots

  // Click handler → open airport panel
  map.on('click', DOT_LAYER, (e) => {
    const features = (e as any).features;
    if (!features?.length) return;
    const icao = features[0].properties?.icao;
    if (icao && airportClickCallback) {
      airportClickCallback(icao);
    }
  });

  map.on('mouseenter', DOT_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', DOT_LAYER, () => { map.getCanvas().style.cursor = ''; });

  console.log('[Airports] Layer initialized');
}

// ---- Click Handler ----

let airportClickCallback: ((icao: string) => void) | null = null;

export function onAirportClick(callback: (icao: string) => void): void {
  airportClickCallback = callback;
}

// ---- Data Update ----

/**
 * Update airport markers based on current pilot and ATC data.
 * Only shows airports that have at least traffic OR ATC.
 */
export function updateAirportData(
  map: MaplibreMap,
  pilots: VatsimPilot[],
  controllers: VatsimController[],
  atis: VatsimAtis[],
): void {
  const airports = new Map<string, AirportInfo>();

  // Count traffic per airport from pilot flight plans
  for (const pilot of pilots) {
    if (!pilot.flight_plan) continue;

    const dep = pilot.flight_plan.departure?.toUpperCase();
    const arr = pilot.flight_plan.arrival?.toUpperCase();

    if (dep && AIRPORT_COORDS[dep]) {
      if (!airports.has(dep)) airports.set(dep, createAirport(dep));
      const apt = airports.get(dep)!;
      if (pilot.groundspeed < 40 && pilot.altitude < 500) apt.ground++;
      else apt.departures++;
    }

    if (arr && AIRPORT_COORDS[arr]) {
      if (!airports.has(arr)) airports.set(arr, createAirport(arr));
      const apt = airports.get(arr)!;
      if (pilot.groundspeed < 40 && pilot.altitude < 500) apt.ground++;
      else apt.arrivals++;
    }
  }

  // Mark airports with ATC
  for (const ctrl of controllers) {
    if (ctrl.facility === 0) continue;
    const parts = ctrl.callsign.split('_');
    if (parts.length < 2) continue;
    const icao = parts[0].toUpperCase();
    if (AIRPORT_COORDS[icao]) {
      if (!airports.has(icao)) airports.set(icao, createAirport(icao));
      airports.get(icao)!.hasATC = true;
    }
  }

  // Mark airports with ATIS
  for (const a of atis) {
    const parts = a.callsign.split('_');
    if (parts.length < 2) continue;
    const icao = parts[0].toUpperCase();
    if (AIRPORT_COORDS[icao]) {
      if (!airports.has(icao)) airports.set(icao, createAirport(icao));
      airports.get(icao)!.hasATIS = true;
    }
  }

  // Build GeoJSON
  const features = Array.from(airports.values()).map(apt => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: apt.coords },
    properties: {
      icao: apt.icao,
      arrivals: apt.arrivals,
      departures: apt.departures,
      ground: apt.ground,
      traffic: apt.arrivals + apt.departures + apt.ground,
      hasATC: apt.hasATC,
      hasATIS: apt.hasATIS,
    },
  }));

  const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData({ type: 'FeatureCollection', features });
  }
}

function createAirport(icao: string): AirportInfo {
  return {
    icao,
    coords: AIRPORT_COORDS[icao],
    arrivals: 0, departures: 0, ground: 0,
    hasATC: false, hasATIS: false,
  };
}

// ---- Visibility ----

export function setAirportsVisible(map: MaplibreMap, visible: boolean): void {
  const v = visible ? 'visible' : 'none';
  if (map.getLayer(DOT_LAYER)) map.setLayoutProperty(DOT_LAYER, 'visibility', v);
  if (map.getLayer(LABEL_LAYER)) map.setLayoutProperty(LABEL_LAYER, 'visibility', v);
}
