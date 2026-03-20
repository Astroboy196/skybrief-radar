// ============================================================
// FIR/CTR Sector Layer — V2
// Shows active ATC sector boundaries from VATSpy data
// Uses VATSpy.dat callsign→FIR mapping for correct matching
// ============================================================

import type { Map as MaplibreMap, GeoJSONSource } from 'maplibre-gl';
import type { VatsimController } from '@/types';
import { CONTROLLER_RATINGS } from '@/types';

// ---- URLs ----

const BOUNDARIES_URL = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/Boundaries.geojson';
const VATSPY_URL = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/VATSpy.dat';

// ---- Layer IDs ----

const SRC = 'sectors-source';
const FILL = 'sectors-fill';
const LINE = 'sectors-line';
const LABEL = 'sectors-label';

// ---- State ----

let boundaryIndex = new Map<string, GeoJSON.Feature[]>(); // FIR boundary ID → features
let callsignToFir = new Map<string, string>(); // callsign prefix → FIR boundary ID
let isLoaded = false;
let clickCallback: ((info: SectorClickInfo) => void) | null = null;

export interface SectorClickInfo {
  id: string;
  callsign: string;
  name: string;
  frequency: string;
  rating: string;
  logonTime: string;
}

// ---- Init ----

export async function initSectorLayer(map: MaplibreMap): Promise<void> {
  map.addSource(SRC, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // Fill
  map.addLayer({
    id: FILL,
    type: 'fill',
    source: SRC,
    paint: {
      'fill-color': [
        'case',
        ['get', 'isOceanic'], 'rgba(59, 130, 246, 0.06)',
        'rgba(234, 88, 12, 0.05)',
      ],
    },
  });

  // Border line
  map.addLayer({
    id: LINE,
    type: 'line',
    source: SRC,
    paint: {
      'line-color': [
        'case',
        ['get', 'isOceanic'], 'rgba(59, 130, 246, 0.45)',
        'rgba(234, 88, 12, 0.55)',
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1, 8, 2],
    },
  });

  // Label in sector center
  map.addLayer({
    id: LABEL,
    type: 'symbol',
    source: SRC,
    layout: {
      'text-field': ['get', 'displayLabel'],
      'text-font': ['Open Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 12],
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': [
        'case',
        ['get', 'isOceanic'], 'rgba(59, 130, 246, 0.55)',
        'rgba(234, 88, 12, 0.5)',
      ],
      'text-halo-color': 'rgba(10, 14, 39, 0.85)',
      'text-halo-width': 1.5,
    },
  });

  // Click
  map.on('click', FILL, (e) => {
    const features = (e as any).features;
    if (!features?.length || !clickCallback) return;
    const p = features[0].properties;
    clickCallback({
      id: p.sectorId || '', callsign: p.callsign || '',
      name: p.controllerName || '', frequency: p.frequency || '',
      rating: p.rating || '', logonTime: p.logonTime || '',
    });
  });

  map.on('mouseenter', FILL, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', FILL, () => { map.getCanvas().style.cursor = ''; });

  // Load data in background
  await loadData();
}

// ---- Data Loading ----

async function loadData(): Promise<void> {
  try {
    // Load both in parallel
    const [boundariesRes, vatspyRes] = await Promise.all([
      fetch(BOUNDARIES_URL),
      fetch(VATSPY_URL),
    ]);

    if (!boundariesRes.ok || !vatspyRes.ok) throw new Error('Failed to fetch data');

    // Parse boundaries GeoJSON
    const boundaries: GeoJSON.FeatureCollection = await boundariesRes.json();
    boundaryIndex = new Map();
    for (const f of boundaries.features) {
      const id = f.properties?.id;
      if (!id) continue;
      if (!boundaryIndex.has(id)) boundaryIndex.set(id, []);
      boundaryIndex.get(id)!.push(f);
    }

    // Parse VATSpy.dat FIR section for callsign→FIR mapping
    const vatspyText = await vatspyRes.text();
    callsignToFir = parseVatspyFirs(vatspyText);

    isLoaded = true;
    console.log(`[Sectors] Loaded ${boundaryIndex.size} boundaries, ${callsignToFir.size} callsign mappings`);
  } catch (error) {
    console.warn('[Sectors] Failed to load:', error);
  }
}

/**
 * Parse VATSpy.dat [FIRs] section.
 * Format: FIR_ID|Name|Callsign Prefix|Boundary ID
 * Maps callsign prefix → boundary ID
 */
function parseVatspyFirs(text: string): Map<string, string> {
  const map = new Map<string, string>();
  let inFirs = false;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '[FIRs]') { inFirs = true; continue; }
    if (trimmed.startsWith('[') && inFirs) break;
    if (!inFirs || trimmed.startsWith(';') || !trimmed) continue;

    const parts = trimmed.split('|');
    if (parts.length < 4) continue;

    const firId = parts[0].trim();
    const callsignPrefix = parts[2].trim();
    const boundaryId = parts[3].trim();

    // Map callsign prefix → boundary ID
    // e.g., "ATL" → "KZTL", "BOS" → "KZBW"
    if (callsignPrefix) {
      map.set(callsignPrefix.toUpperCase(), boundaryId || firId);
    }
    // Also map the FIR ID itself
    if (!map.has(firId.toUpperCase())) {
      map.set(firId.toUpperCase(), boundaryId || firId);
    }
  }

  return map;
}

// ---- Update Active Sectors ----

export function updateSectors(map: MaplibreMap, controllers: VatsimController[]): void {
  if (!isLoaded) return;

  const activeCtrs = controllers.filter(c => c.facility === 6);

  if (activeCtrs.length === 0) {
    const source = map.getSource(SRC) as GeoJSONSource | undefined;
    if (source) source.setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  const features: GeoJSON.Feature[] = [];
  const usedBoundaries = new Set<string>(); // Avoid duplicates

  for (const ctrl of activeCtrs) {
    const boundaryId = resolveBoundaryId(ctrl.callsign);
    if (!boundaryId || usedBoundaries.has(boundaryId)) continue;

    const matched = boundaryIndex.get(boundaryId);
    if (!matched) continue;

    usedBoundaries.add(boundaryId);

    for (const boundary of matched) {
      const isOceanic = boundary.properties?.oceanic === '1';
      const ratingInfo = CONTROLLER_RATINGS[ctrl.rating];

      features.push({
        ...boundary,
        properties: {
          ...boundary.properties,
          sectorId: boundaryId,
          displayLabel: ctrl.callsign,
          callsign: ctrl.callsign,
          controllerName: ctrl.name,
          frequency: ctrl.frequency,
          rating: ratingInfo?.short ?? '?',
          logonTime: ctrl.logon_time,
          isOceanic,
        },
      });
    }
  }

  const source = map.getSource(SRC) as GeoJSONSource | undefined;
  if (source) {
    source.setData({ type: 'FeatureCollection', features });
  }
}

/**
 * Resolve a CTR callsign to a FIR boundary ID.
 * Handles formats like: EDGG_CTR, ATL_CTR, LRBB_X_CTR, DC_321_CTR
 */
function resolveBoundaryId(callsign: string): string | null {
  const parts = callsign.split('_');
  // Remove _CTR suffix
  const withoutCtr = parts.filter(p => p !== 'CTR');

  // Try progressively shorter prefixes
  // e.g., ["EDGG","E"] → try "EDGG_E" then "EDGG"
  // e.g., ["ATL"] → try "ATL"
  // e.g., ["DC","321"] → try "DC_321" then "DC"

  for (let len = withoutCtr.length; len >= 1; len--) {
    const prefix = withoutCtr.slice(0, len).join('_').toUpperCase();

    // Check callsign→FIR mapping first (handles ATL→KZTL etc.)
    const mapped = callsignToFir.get(prefix);
    if (mapped && boundaryIndex.has(mapped)) return mapped;

    // Try hyphenated version (EDGG_E → EDGG-E)
    const hyphenated = withoutCtr.slice(0, len).join('-').toUpperCase();
    if (boundaryIndex.has(hyphenated)) return hyphenated;

    // Try direct match
    if (boundaryIndex.has(prefix)) return prefix;
  }

  // Last resort: just the first part
  const firstPart = withoutCtr[0]?.toUpperCase();
  if (firstPart) {
    const mapped = callsignToFir.get(firstPart);
    if (mapped && boundaryIndex.has(mapped)) return mapped;
    if (boundaryIndex.has(firstPart)) return firstPart;
  }

  return null;
}

// ---- Events ----

export function onSectorClick(callback: (info: SectorClickInfo) => void): void {
  clickCallback = callback;
}

// ---- Visibility ----

export function setSectorsVisible(map: MaplibreMap, visible: boolean): void {
  const v = visible ? 'visible' : 'none';
  for (const id of [FILL, LINE, LABEL]) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', v);
  }
}
