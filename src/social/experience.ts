// ============================================================
// Phase 5: Experience Level Engine
// Calculates pilot experience badges, flight phases, distances
// ============================================================

import {
  EXPERIENCE_LEVELS,
  PILOT_RATINGS,
} from '@/types';
import type {
  ExperienceLevel,
  ExperienceLevelConfig,
  FlightPhase,
  VatsimPilot,
  VatsimFlightPlan,
} from '@/types';

// ---- Experience Level Calculation ----

/**
 * Calculate experience level from pilot rating ID and total flight hours.
 * Matching logic: A pilot qualifies if they meet EITHER the hours OR rating threshold.
 * Levels are checked from highest to lowest (master first).
 */
export function getExperienceLevel(pilotRating: number, totalHours: number | null): ExperienceLevel {
  // If we don't have hours data, use rating alone
  const hours = totalHours ?? 0;

  for (const config of EXPERIENCE_LEVELS) {
    if (hours >= config.minHours || pilotRating >= config.minRating) {
      return config.level;
    }
  }

  return 'beginner';
}

/**
 * Get the full config for an experience level.
 */
export function getExperienceLevelConfig(level: ExperienceLevel): ExperienceLevelConfig {
  return EXPERIENCE_LEVELS.find(l => l.level === level) ?? EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 1];
}

/**
 * Get pilot rating display info.
 */
export function getPilotRatingInfo(ratingId: number): { short: string; long: string } {
  return PILOT_RATINGS[ratingId] ?? { short: 'P0', long: 'No Rating' };
}

// ---- Flight Phase Detection ----

/**
 * Detect the current flight phase based on altitude, speed, and flight plan.
 *
 * Logic:
 * - preflight:  on ground (alt < 500 AGL), not moving (gs < 5)
 * - ground:     on ground, moving slowly (5 <= gs < 40)
 * - departing:  just took off (alt < 5000, gs >= 40, climbing)
 * - climbing:   gaining altitude (alt < cruise level, gs >= 100)
 * - cruising:   at or near cruise altitude (stable high altitude)
 * - descending: losing altitude from cruise
 * - arriving:   low altitude near destination (alt < 5000, descending)
 * - landed:     on ground after being airborne (gs < 40, was flying)
 */
export function detectFlightPhase(
  altitude: number,
  groundspeed: number,
  _flightPlan: VatsimFlightPlan | null,
  prevAltitude?: number,
): FlightPhase {
  const isOnGround = altitude < 500;
  const isMovingSlowly = groundspeed < 40;
  const isMoving = groundspeed >= 5;
  const isFast = groundspeed >= 100;
  const isHigh = altitude >= 10000;
  const isVeryHigh = altitude >= 20000;

  // Altitude trend
  const altDelta = prevAltitude !== undefined ? altitude - prevAltitude : 0;
  const isClimbing = altDelta > 100;
  const isDescending = altDelta < -100;

  // On ground, not moving
  if (isOnGround && !isMoving) {
    return 'preflight';
  }

  // On ground, taxiing
  if (isOnGround && isMovingSlowly) {
    return 'ground';
  }

  // Just taken off or about to land
  if (altitude < 5000 && !isOnGround) {
    if (isClimbing || (!isDescending && groundspeed >= 80)) {
      return 'departing';
    }
    return 'arriving';
  }

  // In the air, high altitude
  if (isVeryHigh) {
    if (isClimbing) return 'climbing';
    if (isDescending) return 'descending';
    return 'cruising';
  }

  // Mid altitude
  if (isHigh) {
    if (isClimbing) return 'climbing';
    if (isDescending) return 'descending';
    return 'cruising';
  }

  // Between 5000 and 10000 ft
  if (isFast) {
    if (isClimbing) return 'climbing';
    if (isDescending) return 'descending';
    return 'cruising';
  }

  // Low and slow — likely approaching
  if (isDescending) return 'arriving';

  return 'ground';
}

// ---- Geographic Calculations ----

const EARTH_RADIUS_NM = 3440.065; // Nautical miles

/**
 * Calculate distance between two points using the Haversine formula.
 * Returns distance in nautical miles.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate distance from pilot's current position to their arrival airport.
 * Returns null if no flight plan or unknown arrival coordinates.
 */
export function distanceToDestination(
  pilot: VatsimPilot,
  airportCoords: Map<string, [number, number]>,
): number | null {
  if (!pilot.flight_plan?.arrival) return null;

  const dest = airportCoords.get(pilot.flight_plan.arrival.toUpperCase());
  if (!dest) return null;

  return Math.round(haversineDistance(pilot.latitude, pilot.longitude, dest[0], dest[1]));
}

/**
 * Calculate estimated time of arrival in minutes.
 * Returns null if distance or speed is unavailable.
 */
export function calculateEta(distanceNm: number | null, groundspeedKts: number): number | null {
  if (distanceNm === null || groundspeedKts < 30) return null;
  return Math.round((distanceNm / groundspeedKts) * 60);
}

/**
 * Format ETA minutes to human-readable string.
 */
export function formatEta(minutes: number | null): string {
  if (minutes === null) return '--:--';
  if (minutes < 0) return '00:00';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m`;
}

/**
 * Format flight hours to a display string.
 */
export function formatHours(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 1) return '< 1h';
  if (hours < 10) return `${hours.toFixed(1)}h`;
  return `${Math.round(hours).toLocaleString()}h`;
}
