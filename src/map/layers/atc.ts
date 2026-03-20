// ============================================================
// ATC Controller Layer — V3
// Airport ICAO labels with active ATC facility badges
// Visible at ALL zoom levels when ATC is online
// ============================================================

import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { VatsimController, VatsimAtis } from '@/types';
import { FACILITY_TYPES } from '@/types';
import { getAirportCoords } from '@/data/airports-db';

// ---- IDs ----

const ATC_SOURCE_ID = 'atc-source';
const ATC_ICAO_LAYER_ID = 'atc-icao';
const ATC_BADGES_LAYER_ID = 'atc-badges';

// ---- Init ----

export function initAtcLayer(map: MaplibreMap): void {
  map.addSource(ATC_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // ICAO label (always visible, no minzoom)
  map.addLayer({
    id: ATC_ICAO_LAYER_ID,
    type: 'symbol',
    source: ATC_SOURCE_ID,
    layout: {
      'text-field': ['get', 'icao'],
      'text-font': ['Open Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        3, 10,
        6, 12,
        10, 14,
      ],
      'text-anchor': 'bottom',
      'text-offset': [0, -0.3],
      'text-allow-overlap': true,
      'text-optional': false,
    },
    paint: {
      'text-color': '#e2e8f0',
      'text-halo-color': 'rgba(10, 14, 39, 0.95)',
      'text-halo-width': 2,
    },
  }); // No 'before' — ATC labels render ON TOP

  // Facility badges line below ICAO (D G T A)
  map.addLayer({
    id: ATC_BADGES_LAYER_ID,
    type: 'symbol',
    source: ATC_SOURCE_ID,
    layout: {
      'text-field': ['get', 'badgeLine'],
      'text-font': ['Open Sans Bold'],
      'text-size': [
        'interpolate', ['linear'], ['zoom'],
        3, 8,
        6, 10,
        10, 11,
      ],
      'text-anchor': 'top',
      'text-offset': [0, 0.1],
      'text-allow-overlap': true,
      'text-optional': true,
    },
    paint: {
      'text-color': '#22c55e',
      'text-halo-color': 'rgba(10, 14, 39, 0.95)',
      'text-halo-width': 1.5,
    },
  }); // ON TOP
}

// ---- Update ----

export function updateAtcData(
  map: MaplibreMap,
  controllers: VatsimController[],
  atis: VatsimAtis[],
): void {
  // Group by airport ICAO
  const airports = new Map<string, {
    icao: string;
    facilities: Set<string>;
    hasAtis: boolean;
    atisCode: string;
    position: [number, number];
  }>();

  for (const ctrl of controllers) {
    if (ctrl.facility === 0) continue;
    const parts = ctrl.callsign.split('_');
    if (parts.length < 2) continue;
    const icao = parts[0].toUpperCase();

    const pos = getAirportCoords(icao);
    if (!pos) continue;

    if (!airports.has(icao)) {
      airports.set(icao, { icao, facilities: new Set(), hasAtis: false, atisCode: '', position: pos });
    }

    const facilityName = FACILITY_TYPES[ctrl.facility];
    if (facilityName) {
      // Use single letter: DEL→D, GND→G, TWR→T, APP→A, CTR→C
      airports.get(icao)!.facilities.add(facilityName.charAt(0));
    }
  }

  for (const a of atis) {
    const parts = a.callsign.split('_');
    if (parts.length < 2) continue;
    const icao = parts[0].toUpperCase();
    const pos = getAirportCoords(icao);
    if (!pos) continue;

    if (!airports.has(icao)) {
      airports.set(icao, { icao, facilities: new Set(), hasAtis: true, atisCode: a.atis_code || '', position: pos });
    } else {
      airports.get(icao)!.hasAtis = true;
      airports.get(icao)!.atisCode = a.atis_code || '';
    }
  }

  // Build features
  const features = Array.from(airports.values()).map(apt => {
    // Build badge line: "D  G  T  A" or "T  A" etc.
    const badgeParts: string[] = [];
    if (apt.facilities.has('D')) badgeParts.push('D');
    if (apt.facilities.has('G')) badgeParts.push('G');
    if (apt.facilities.has('T')) badgeParts.push('T');
    if (apt.facilities.has('A')) badgeParts.push('A');
    if (apt.facilities.has('C')) badgeParts.push('C');
    if (apt.hasAtis) badgeParts.push(apt.atisCode ? `[${apt.atisCode}]` : 'ATIS');

    // Priority: more facilities = show first (lower value = higher priority)
    const priority = 10 - apt.facilities.size;

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: apt.position,
      },
      properties: {
        icao: apt.icao,
        badgeLine: badgeParts.join('  '),
        facilityCount: apt.facilities.size,
        priority,
      },
    };
  });

  console.log(`[ATC] ${airports.size} airports with ATC, ${features.length} features created`);

  const source = map.getSource(ATC_SOURCE_ID) as GeoJSONSource | undefined;
  if (source) {
    source.setData({ type: 'FeatureCollection', features });
  } else {
    console.error('[ATC] Source not found! Layer may not be initialized');
  }
}

// ---- Visibility ----

export function setAtcVisible(map: MaplibreMap, visible: boolean): void {
  const v = visible ? 'visible' : 'none';
  if (map.getLayer(ATC_ICAO_LAYER_ID)) map.setLayoutProperty(ATC_ICAO_LAYER_ID, 'visibility', v);
  if (map.getLayer(ATC_BADGES_LAYER_ID)) map.setLayoutProperty(ATC_BADGES_LAYER_ID, 'visibility', v);
}
