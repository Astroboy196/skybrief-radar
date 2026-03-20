// ============================================================
// Phase 6: Enriched Pilot Pipeline
// Transforms raw VATSIM data → fully enriched pilot objects
// Builds GeoJSON FeatureCollection for MapLibre rendering
// ============================================================

import type {
  VatsimPilot,
  EnrichedPilot,
  SocialProfile,
  StreamingStatus,
  FlightPhase,
  ExperienceLevel,
  AircraftCategory,
} from '@/types';
import type { VatsimDataState } from './vatsim-api';
import { getActiveFrequency } from './vatsim-api';
import { getCachedStats } from './vatsim-stats';
import {
  getExperienceLevel,
  getPilotRatingInfo,
  detectFlightPhase,
} from '@/social/experience';

// ---- Types ----

export interface PilotGeoJsonProperties {
  cid: number;
  callsign: string;
  heading: number;
  altitude: number;
  groundspeed: number;
  aircraftType: string;
  aircraftCategory: AircraftCategory;
  flightPhase: FlightPhase;
  experienceLevel: ExperienceLevel;
  isStreaming: boolean;
  departure: string;
  arrival: string;
}

export interface PilotGeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  properties: PilotGeoJsonProperties;
}

export interface PilotGeoJsonCollection {
  type: 'FeatureCollection';
  features: PilotGeoJsonFeature[];
}

// ---- Previous Position Tracking ----

const previousPositions = new Map<number, {
  lat: number;
  lng: number;
  heading: number;
  altitude: number;
  timestamp: number;
}>();

// ---- Aircraft Type Mapping ----

const TYPE_TO_CATEGORY: Record<string, AircraftCategory> = {
  // Single Prop
  'C152': 'single-prop', 'C172': 'single-prop', 'C182': 'single-prop',
  'PA28': 'single-prop', 'PA32': 'single-prop', 'DA40': 'single-prop',
  'SR22': 'single-prop', 'P28A': 'single-prop', 'C150': 'single-prop',
  'DA20': 'single-prop', 'DR40': 'single-prop', 'C206': 'single-prop',

  // Twin Prop
  'C310': 'twin-prop', 'BE58': 'twin-prop', 'PA34': 'twin-prop',
  'DA42': 'twin-prop', 'BE20': 'twin-prop', 'C414': 'twin-prop',
  'DHC6': 'twin-prop', 'BE9L': 'twin-prop', 'C421': 'twin-prop',

  // Turboprop
  'AT45': 'twin-prop', 'AT72': 'twin-prop', 'AT76': 'twin-prop',
  'DH8A': 'twin-prop', 'DH8B': 'twin-prop', 'DH8C': 'twin-prop',
  'DH8D': 'twin-prop', 'SF34': 'twin-prop', 'JS32': 'twin-prop',
  'B350': 'twin-prop', 'PC12': 'single-prop', 'TBM9': 'single-prop',

  // Business Jet
  'C510': 'business-jet', 'C525': 'business-jet', 'C560': 'business-jet',
  'C680': 'business-jet', 'C700': 'business-jet', 'CL35': 'business-jet',
  'CL60': 'business-jet', 'E35L': 'business-jet', 'E55P': 'business-jet',
  'FA50': 'business-jet', 'FA7X': 'business-jet', 'F900': 'business-jet',
  'G280': 'business-jet', 'GLEX': 'business-jet', 'GLF5': 'business-jet',
  'GLF6': 'business-jet', 'GL7T': 'business-jet', 'LJ45': 'business-jet',
  'LJ75': 'business-jet', 'PC24': 'business-jet', 'PRM1': 'business-jet',
  'HDJT': 'business-jet', 'EA50': 'business-jet',

  // Regional Jet
  'CRJ2': 'regional-jet', 'CRJ7': 'regional-jet', 'CRJ9': 'regional-jet',
  'CRJX': 'regional-jet', 'E170': 'regional-jet', 'E175': 'regional-jet',
  'E190': 'regional-jet', 'E195': 'regional-jet', 'E290': 'regional-jet',
  'E295': 'regional-jet',

  // Narrow Body
  'A318': 'narrow-body', 'A319': 'narrow-body', 'A320': 'narrow-body',
  'A321': 'narrow-body', 'A20N': 'narrow-body', 'A21N': 'narrow-body',
  'B731': 'narrow-body', 'B732': 'narrow-body', 'B733': 'narrow-body',
  'B734': 'narrow-body', 'B735': 'narrow-body', 'B736': 'narrow-body',
  'B737': 'narrow-body', 'B738': 'narrow-body', 'B739': 'narrow-body',
  'B37M': 'narrow-body', 'B38M': 'narrow-body', 'B39M': 'narrow-body',
  'B752': 'narrow-body', 'B753': 'narrow-body',
  'BCS1': 'narrow-body', 'BCS3': 'narrow-body',
  'MD82': 'narrow-body', 'MD83': 'narrow-body', 'MD87': 'narrow-body',
  'MD88': 'narrow-body', 'MD90': 'narrow-body',

  // Wide Body
  'A332': 'wide-body', 'A333': 'wide-body', 'A338': 'wide-body',
  'A339': 'wide-body', 'A342': 'wide-body', 'A343': 'wide-body',
  'A345': 'wide-body', 'A346': 'wide-body',
  'A359': 'wide-body', 'A35K': 'wide-body',
  'B762': 'wide-body', 'B763': 'wide-body', 'B764': 'wide-body',
  'B772': 'wide-body', 'B773': 'wide-body', 'B77L': 'wide-body',
  'B77W': 'wide-body', 'B778': 'wide-body', 'B779': 'wide-body',
  'B788': 'wide-body', 'B789': 'wide-body', 'B78X': 'wide-body',
  'DC10': 'wide-body', 'MD11': 'wide-body', 'L101': 'wide-body',
  'IL96': 'wide-body',

  // Jumbo
  'A380': 'jumbo', 'A388': 'jumbo',
  'B741': 'jumbo', 'B742': 'jumbo', 'B743': 'jumbo',
  'B744': 'jumbo', 'B748': 'jumbo', 'B74S': 'jumbo',

  // Cargo (specific cargo variants)
  'B74F': 'cargo', 'B77F': 'cargo', 'B76F': 'cargo',
  'A30B': 'cargo', 'A3ST': 'cargo',

  // Helicopter
  'H135': 'helicopter', 'H145': 'helicopter', 'H160': 'helicopter',
  'EC35': 'helicopter', 'EC45': 'helicopter', 'AS50': 'helicopter',
  'B06': 'helicopter', 'B407': 'helicopter', 'R44': 'helicopter',
  'R22': 'helicopter', 'S76': 'helicopter', 'B412': 'helicopter',

  // Military Fighter
  'F16': 'military-fighter', 'F18': 'military-fighter', 'F15': 'military-fighter',
  'F22': 'military-fighter', 'F35': 'military-fighter', 'EUFI': 'military-fighter',
  'RFAL': 'military-fighter', 'FA18': 'military-fighter', 'T38': 'military-fighter',

  // Military Transport
  'C130': 'military-transport', 'C17': 'military-transport',
  'C5': 'military-transport', 'A400': 'military-transport',
  'KC35': 'military-transport', 'KC10': 'military-transport',
};

/**
 * Map an ICAO aircraft type code to a visual category.
 */
export function getAircraftCategory(typeCode: string): AircraftCategory {
  if (!typeCode) return 'unknown';
  const code = typeCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return TYPE_TO_CATEGORY[code] ?? guessCategory(code);
}

function guessCategory(code: string): AircraftCategory {
  // Heuristic guesses based on code patterns
  if (code.startsWith('H') || code.startsWith('EC') || code.startsWith('AS') || code.startsWith('R')) {
    if (code.length <= 4 && /^(H|EC|AS|R|S7|B4)\d/.test(code)) return 'helicopter';
  }
  if (code.startsWith('F') && /^F\d{2}/.test(code)) return 'military-fighter';
  if (code.startsWith('C1') && code.length <= 4) return 'military-transport';
  if (code.startsWith('B7')) return 'wide-body';
  if (code.startsWith('B3')) return 'narrow-body';
  if (code.startsWith('A3')) return 'wide-body';
  if (code.startsWith('A2') || code.startsWith('A1')) return 'narrow-body';
  return 'unknown';
}

// ---- Pipeline: Raw → Enriched ----

const DEFAULT_STREAMING: StreamingStatus = {
  isLive: false,
  platform: 'none',
  username: '',
  streamUrl: '',
  viewerCount: 0,
  title: '',
  thumbnailUrl: '',
};

/**
 * Transform a raw VatsimPilot into a fully enriched pilot object.
 */
export function enrichPilot(
  raw: VatsimPilot,
  options: {
    socialProfiles?: Map<number, SocialProfile>;
    streamingStatuses?: Map<number, StreamingStatus>;
    airportCoords?: Map<string, [number, number]>;
  } = {},
): EnrichedPilot {
  // Get previous position for interpolation and phase detection
  const prev = previousPositions.get(raw.cid);
  const prevAltitude = prev?.altitude;

  // Update previous position tracking
  previousPositions.set(raw.cid, {
    lat: raw.latitude,
    lng: raw.longitude,
    heading: raw.heading,
    altitude: raw.altitude,
    timestamp: Date.now(),
  });

  // Rating info
  const ratingInfo = getPilotRatingInfo(raw.pilot_rating);

  // Stats (from cache — loaded asynchronously)
  const stats = getCachedStats(raw.cid);
  const totalPilotHours = stats?.pilot ?? null;

  // Experience level
  const experienceLevel = getExperienceLevel(raw.pilot_rating, totalPilotHours);

  // Flight phase
  const flightPhase = detectFlightPhase(
    raw.altitude,
    raw.groundspeed,
    raw.flight_plan,
    prevAltitude,
  );

  // Social profile
  const socialProfile = options.socialProfiles?.get(raw.cid) ?? null;

  // Streaming status
  const streaming = options.streamingStatuses?.get(raw.cid) ?? DEFAULT_STREAMING;

  // Active frequency from transceivers
  const activeFrequency = getActiveFrequency(raw.callsign);

  return {
    cid: raw.cid,
    name: raw.name,
    callsign: raw.callsign,
    latitude: raw.latitude,
    longitude: raw.longitude,
    altitude: raw.altitude,
    groundspeed: raw.groundspeed,
    heading: raw.heading,
    transponder: raw.transponder,
    logonTime: raw.logon_time,
    lastUpdated: raw.last_updated,
    flightPlan: raw.flight_plan,
    flightPhase,
    distanceToDestination: null, // Calculated separately if airport coords available
    etaMinutes: null,
    pilotRating: raw.pilot_rating,
    pilotRatingShort: ratingInfo.short,
    pilotRatingLong: ratingInfo.long,
    militaryRating: raw.military_rating,
    stats,
    totalPilotHours,
    experienceLevel,
    socialProfile,
    streaming,
    activeFrequency,
    prevLatitude: prev?.lat ?? raw.latitude,
    prevLongitude: prev?.lng ?? raw.longitude,
    prevHeading: prev?.heading ?? raw.heading,
    interpolationProgress: 0,
  };
}

/**
 * Transform all pilots from a VATSIM data state into enriched pilots.
 */
export function enrichAllPilots(
  dataState: VatsimDataState,
  options: {
    socialProfiles?: Map<number, SocialProfile>;
    streamingStatuses?: Map<number, StreamingStatus>;
    airportCoords?: Map<string, [number, number]>;
  } = {},
): EnrichedPilot[] {
  const enriched = dataState.pilots.map(raw => enrichPilot(raw, options));

  // Register airport positions from pilots on ground (best position estimate)
  for (const pilot of dataState.pilots) {
    if (!pilot.flight_plan) continue;
    if (pilot.groundspeed < 40 && pilot.altitude < 500) {
      // Pilot is on ground — register their position as airport position
      if (pilot.flight_plan.departure) {
        registeredAirportPositions.set(pilot.flight_plan.departure.toUpperCase(), [pilot.longitude, pilot.latitude]);
      }
    }
  }

  return enriched;
}

/** Airport positions learned from pilot ground positions */
export const registeredAirportPositions = new Map<string, [number, number]>();

// ---- GeoJSON Builder ----

/**
 * Build a GeoJSON FeatureCollection from enriched pilots.
 * This is what MapLibre uses to render aircraft on the map.
 */
export function buildGeoJson(pilots: EnrichedPilot[]): PilotGeoJsonCollection {
  return {
    type: 'FeatureCollection',
    features: pilots.map(pilot => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [pilot.longitude, pilot.latitude],
      },
      properties: {
        cid: pilot.cid,
        callsign: pilot.callsign,
        heading: pilot.heading,
        altitude: pilot.altitude,
        groundspeed: pilot.groundspeed,
        aircraftType: pilot.flightPlan?.aircraft_short ?? '',
        aircraftCategory: getAircraftCategory(pilot.flightPlan?.aircraft_short ?? ''),
        flightPhase: pilot.flightPhase,
        experienceLevel: pilot.experienceLevel,
        isStreaming: pilot.streaming.isLive,
        departure: pilot.flightPlan?.departure ?? '',
        arrival: pilot.flightPlan?.arrival ?? '',
      },
    })),
  };
}

/**
 * Clean up previous positions for pilots that are no longer online.
 */
export function cleanupOfflinePilots(onlineCids: Set<number>): number {
  let cleaned = 0;
  for (const cid of previousPositions.keys()) {
    if (!onlineCids.has(cid)) {
      previousPositions.delete(cid);
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * Reset all state (for testing).
 */
export function _resetPipeline(): void {
  previousPositions.clear();
}
