// ============================================================
// Phase 9: Weather Data Services
// METAR decoding, SIGMET fetching, RainViewer radar tiles
// Sources: VATSIM METAR API, AviationWeather.gov, RainViewer
// ============================================================

import type {
  DecodedMetar,
  FlightRules,
  CloudLayer,
  SigmetData,
  SigmetHazard,
  RainViewerData,
  RainViewerFrame,
} from '@/types';

// ---- Configuration ----

const METAR_CACHE_TTL_MS = 5 * 60 * 1000;    // 5 minutes
const SIGMET_CACHE_TTL_MS = 10 * 60 * 1000;  // 10 minutes
const RAINVIEWER_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

const IS_DEV = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const METAR_URL = IS_DEV ? '/api/metar' : 'https://metar.vatsim.net';
const SIGMET_URL = IS_DEV ? '/api/weather/airsigmet' : 'https://aviationweather.gov/api/data/airsigmet';
const RAINVIEWER_URL = 'https://api.rainviewer.com/public/weather-maps.json';

// ---- Caches ----

const metarCache = new Map<string, { data: DecodedMetar; fetchedAt: number }>();
let sigmetCache: { data: SigmetData[]; fetchedAt: number } | null = null;
let rainviewerCache: { data: RainViewerData; fetchedAt: number } | null = null;

// ---- METAR Fetching ----

/**
 * Fetch METAR for an airport ICAO code.
 */
export async function fetchMetar(icao: string): Promise<DecodedMetar | null> {
  const key = icao.toUpperCase();

  // Check cache
  const cached = metarCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < METAR_CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const response = await fetch(`${METAR_URL}/${key}?format=json`);
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const raw = data[0].metar as string;
    if (!raw) return null;

    const decoded = decodeMetar(key, raw);
    metarCache.set(key, { data: decoded, fetchedAt: Date.now() });
    return decoded;
  } catch (error) {
    console.warn(`[Weather] Failed to fetch METAR for ${key}:`, error);
    return null;
  }
}

// ---- METAR Decoding ----

/**
 * Decode a raw METAR string into structured data.
 */
export function decodeMetar(icao: string, raw: string): DecodedMetar {
  const parts = raw.trim().split(/\s+/);

  return {
    icao,
    raw,
    observationTime: extractObservationTime(parts),
    wind: extractWind(parts),
    visibility: extractVisibility(parts),
    ceiling: extractCeiling(parts),
    temperature: extractTemperature(parts),
    dewpoint: extractDewpoint(parts),
    altimeter: extractAltimeter(parts),
    flightRules: 'VFR', // Will be calculated after
    clouds: extractClouds(parts),
    conditions: [],
  };
}

function extractObservationTime(parts: string[]): string {
  const match = parts.find(p => /^\d{6}Z$/.test(p));
  return match ?? '';
}

function extractWind(parts: string[]): DecodedMetar['wind'] {
  const match = parts.find(p => /^\d{3,5}(G\d{2,3})?KT$/.test(p) || /^VRB\d{2,3}KT$/.test(p));
  if (!match) return { direction: null, speed: 0, gust: null, variable: false };

  const variable = match.startsWith('VRB');
  const direction = variable ? null : parseInt(match.substring(0, 3));
  const speedMatch = match.match(/(\d{2,3})(?:G(\d{2,3}))?KT/);
  const speed = speedMatch ? parseInt(speedMatch[1]) : 0;
  const gust = speedMatch?.[2] ? parseInt(speedMatch[2]) : null;

  return { direction, speed, gust, variable };
}

function extractVisibility(parts: string[]): DecodedMetar['visibility'] {
  // Try meters format (4 digits)
  const metersMatch = parts.find(p => /^\d{4}$/.test(p) && parseInt(p) <= 9999);
  if (metersMatch) {
    const meters = parseInt(metersMatch);
    return { meters, statute: meters * 0.000621371 };
  }

  // Try statute miles format
  const smMatch = parts.find(p => /^\d+SM$/.test(p));
  if (smMatch) {
    const sm = parseInt(smMatch);
    return { meters: sm * 1609.34, statute: sm };
  }

  // Default 10SM+ (CAVOK or no vis reported)
  return { meters: 16093, statute: 10 };
}

function extractClouds(parts: string[]): CloudLayer[] {
  const clouds: CloudLayer[] = [];
  const cloudTypes = ['FEW', 'SCT', 'BKN', 'OVC'];

  for (const part of parts) {
    for (const type of cloudTypes) {
      if (part.startsWith(type)) {
        const altStr = part.substring(3, 6);
        const altitude = parseInt(altStr) * 100;
        const cbTcu = part.includes('CB') ? 'CB' as const : part.includes('TCU') ? 'TCU' as const : undefined;
        clouds.push({
          coverage: type as CloudLayer['coverage'],
          altitude: isNaN(altitude) ? 0 : altitude,
          type: cbTcu,
        });
      }
    }

    if (part === 'CLR' || part === 'SKC' || part === 'NCD' || part === 'CAVOK') {
      clouds.push({ coverage: part === 'CAVOK' ? 'NCD' : part as CloudLayer['coverage'], altitude: 99999 });
    }
  }

  return clouds;
}

function extractCeiling(parts: string[]): number | null {
  const clouds = extractClouds(parts);
  const ceiling = clouds.find(c => c.coverage === 'BKN' || c.coverage === 'OVC');
  return ceiling?.altitude ?? null;
}

function extractTemperature(parts: string[]): number {
  const match = parts.find(p => /^M?\d{2}\/M?\d{2}$/.test(p));
  if (!match) return 0;
  const temp = match.split('/')[0];
  return temp.startsWith('M') ? -parseInt(temp.substring(1)) : parseInt(temp);
}

function extractDewpoint(parts: string[]): number {
  const match = parts.find(p => /^M?\d{2}\/M?\d{2}$/.test(p));
  if (!match) return 0;
  const dew = match.split('/')[1];
  return dew.startsWith('M') ? -parseInt(dew.substring(1)) : parseInt(dew);
}

function extractAltimeter(parts: string[]): DecodedMetar['altimeter'] {
  // QNH format (Q1013)
  const qMatch = parts.find(p => /^Q\d{4}$/.test(p));
  if (qMatch) {
    const hpa = parseInt(qMatch.substring(1));
    return { hpa, inhg: hpa * 0.02953 };
  }

  // Altimeter format (A2992)
  const aMatch = parts.find(p => /^A\d{4}$/.test(p));
  if (aMatch) {
    const inhg = parseInt(aMatch.substring(1)) / 100;
    return { hpa: Math.round(inhg / 0.02953), inhg };
  }

  return { hpa: 1013, inhg: 29.92 };
}

/**
 * Calculate flight rules category from visibility and ceiling.
 */
export function calculateFlightRules(
  visibilityStatuteMiles: number,
  ceilingFeet: number | null,
): FlightRules {
  const ceil = ceilingFeet ?? 99999;

  // LIFR: Ceiling < 500 ft OR Visibility < 1 SM
  if (ceil < 500 || visibilityStatuteMiles < 1) return 'LIFR';

  // IFR: Ceiling 500-999 ft OR Visibility 1-2.99 SM
  if (ceil < 1000 || visibilityStatuteMiles < 3) return 'IFR';

  // MVFR: Ceiling 1000-2999 ft OR Visibility 3-4.99 SM
  if (ceil < 3000 || visibilityStatuteMiles < 5) return 'MVFR';

  // VFR: Ceiling >= 3000 ft AND Visibility >= 5 SM
  return 'VFR';
}

// ---- SIGMET Fetching ----

/**
 * Fetch SIGMETs from AviationWeather.gov.
 */
export async function fetchSigmets(): Promise<SigmetData[]> {
  // Check cache
  if (sigmetCache && Date.now() - sigmetCache.fetchedAt < SIGMET_CACHE_TTL_MS) {
    return sigmetCache.data;
  }

  try {
    const response = await fetch(`${SIGMET_URL}?format=json`);
    if (!response.ok) return sigmetCache?.data ?? [];

    const rawData = await response.json();
    const sigmets = parseSigmets(rawData);
    sigmetCache = { data: sigmets, fetchedAt: Date.now() };
    return sigmets;
  } catch (error) {
    console.warn('[Weather] Failed to fetch SIGMETs:', error);
    return sigmetCache?.data ?? [];
  }
}

/**
 * Parse SIGMET response into structured data.
 */
export function parseSigmets(rawData: unknown): SigmetData[] {
  if (!Array.isArray(rawData)) return [];

  const sigmets: SigmetData[] = [];

  for (const item of rawData) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;

    // Must have coordinates to be displayable
    if (!raw.coords && !raw.geometry) continue;

    const hazard = categorizeHazard(String(raw.hazard ?? raw.rawAirSigmet ?? ''));

    sigmets.push({
      id: String(raw.airSigmetId ?? raw.id ?? Math.random()),
      type: categorizeType(String(raw.airSigmetType ?? '')),
      hazard,
      severity: categorizeSeverity(String(raw.severity ?? '')),
      validFrom: String(raw.validTimeFrom ?? ''),
      validTo: String(raw.validTimeTo ?? ''),
      altitudeLow: raw.altitudeLow != null ? Number(raw.altitudeLow) : null,
      altitudeHigh: raw.altitudeHigh != null ? Number(raw.altitudeHigh) : null,
      rawText: String(raw.rawAirSigmet ?? raw.rawText ?? ''),
      geometry: buildGeometry(raw),
    });
  }

  return sigmets;
}

function categorizeType(type: string): SigmetData['type'] {
  if (type.includes('SIGMET')) return 'SIGMET';
  if (type.includes('AIRMET')) return 'AIRMET';
  if (type.includes('CWA')) return 'CWA';
  return 'SIGMET';
}

export function categorizeHazard(text: string): SigmetHazard {
  const upper = text.toUpperCase();
  if (upper.includes('TURB')) return 'TURB';
  if (upper.includes('ICE') || upper.includes('ICING')) return 'ICE';
  if (upper.includes('TS') || upper.includes('THUNDER') || upper.includes('CONVECT')) return 'TS';
  if (upper.includes('IFR') || upper.includes('CEIL') || upper.includes('VIS')) return 'IFR';
  if (upper.includes('MTN') || upper.includes('OBSCN')) return 'MTN_OBSCN';
  if (upper.includes('VA') || upper.includes('VOLCANIC')) return 'VA';
  if (upper.includes('TC') || upper.includes('TROPICAL')) return 'TC';
  if (upper.includes('SS') || upper.includes('SAND')) return 'SS';
  return 'OTHER';
}

function categorizeSeverity(severity: string): SigmetData['severity'] {
  const upper = severity.toUpperCase();
  if (upper.includes('SEV') || upper.includes('EXTREME')) return 'SEVERE';
  if (upper.includes('MOD')) return 'MODERATE';
  if (upper.includes('LGT') || upper.includes('LIGHT')) return 'LIGHT';
  return 'NONE';
}

function buildGeometry(raw: Record<string, unknown>): SigmetData['geometry'] {
  // If geometry is already GeoJSON
  if (raw.geometry && typeof raw.geometry === 'object') {
    return raw.geometry as SigmetData['geometry'];
  }

  // Build from coords array
  if (Array.isArray(raw.coords)) {
    const coords = (raw.coords as Array<{ lat: number; lon: number }>)
      .map(c => [c.lon, c.lat] as [number, number]);

    if (coords.length >= 3) {
      // Close the polygon
      if (coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1]) {
        coords.push(coords[0]);
      }
      return { type: 'Polygon', coordinates: [coords] };
    }
  }

  // Fallback: empty polygon
  return { type: 'Polygon', coordinates: [[]] };
}

// ---- RainViewer ----

/**
 * Fetch RainViewer radar tile URLs.
 */
export async function fetchRainViewerData(): Promise<RainViewerData | null> {
  // Check cache
  if (rainviewerCache && Date.now() - rainviewerCache.fetchedAt < RAINVIEWER_CACHE_TTL_MS) {
    return rainviewerCache.data;
  }

  try {
    const response = await fetch(RAINVIEWER_URL);
    if (!response.ok) return rainviewerCache?.data ?? null;

    const data: RainViewerData = await response.json();
    rainviewerCache = { data, fetchedAt: Date.now() };
    return data;
  } catch (error) {
    console.warn('[Weather] Failed to fetch RainViewer data:', error);
    return rainviewerCache?.data ?? null;
  }
}

/**
 * Build a MapLibre-compatible tile URL for a RainViewer frame.
 */
export function buildRainViewerTileUrl(frame: RainViewerFrame, host: string): string {
  return `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/**
 * Get the most recent radar frames (past + nowcast).
 */
export function getRadarFrames(data: RainViewerData): RainViewerFrame[] {
  return [...(data.radar.past ?? []), ...(data.radar.nowcast ?? [])];
}

// ---- Cache Management ----

/**
 * Clear all weather caches.
 */
export function clearWeatherCache(): void {
  metarCache.clear();
  sigmetCache = null;
  rainviewerCache = null;
}

/**
 * Get METAR cache size.
 */
export function getMetarCacheSize(): number {
  return metarCache.size;
}
