// ============================================================
// Enhanced Pilot Types — Enriched from multiple data sources
// ============================================================

import type { VatsimFlightPlan, VatsimMemberStats } from './vatsim';

/** Experience levels based on pilot rating + total flight hours */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';

/** Flight phase detected from altitude, speed, and flight plan */
export type FlightPhase =
  | 'preflight'     // Connected, no movement
  | 'ground'        // On ground, moving slowly
  | 'departing'     // Taking off / initial climb
  | 'climbing'      // Climbing to cruise
  | 'cruising'      // Level flight at altitude
  | 'descending'    // Descending from cruise
  | 'arriving'      // On approach / landing
  | 'landed';       // Just landed, decelerating

/** Social media profile (stored in our database) */
export interface SocialProfile {
  cid: number;
  twitch?: string;
  youtube?: string;
  instagram?: string;
  streamUrl?: string;
  bio?: string;
  avatarUrl?: string;
  updatedAt: number;
}

/** Streaming status from live detection */
export interface StreamingStatus {
  isLive: boolean;
  platform: 'twitch' | 'youtube' | 'none';
  username: string;
  streamUrl: string;
  viewerCount: number;
  title: string;
  thumbnailUrl: string;
}

/** Fully enriched pilot with all data sources combined */
export interface EnrichedPilot {
  // Core VATSIM data
  cid: number;
  name: string;
  callsign: string;
  latitude: number;
  longitude: number;
  altitude: number;
  groundspeed: number;
  heading: number;
  transponder: string;
  logonTime: string;
  lastUpdated: string;

  // Flight plan
  flightPlan: VatsimFlightPlan | null;

  // Computed flight info
  flightPhase: FlightPhase;
  distanceToDestination: number | null;
  etaMinutes: number | null;

  // Rating info
  pilotRating: number;
  pilotRatingShort: string;
  pilotRatingLong: string;
  militaryRating: number;

  // Stats (from Stats API, cached)
  stats: VatsimMemberStats | null;
  totalPilotHours: number | null;

  // Experience (computed from rating + hours)
  experienceLevel: ExperienceLevel;

  // Social (from our profile store)
  socialProfile: SocialProfile | null;

  // Streaming (from live detection)
  streaming: StreamingStatus;

  // Active frequency (from transceivers API)
  activeFrequency: string | null;

  // Previous position for interpolation
  prevLatitude: number;
  prevLongitude: number;
  prevHeading: number;
  interpolationProgress: number;
}

/** Experience level configuration */
export interface ExperienceLevelConfig {
  level: ExperienceLevel;
  label: string;
  color: string;
  minHours: number;
  minRating: number;
  icon: string;
}

export const EXPERIENCE_LEVELS: ExperienceLevelConfig[] = [
  { level: 'master',       label: 'Master',       color: '#06b6d4', minHours: 5000, minRating: 31, icon: 'diamond' },
  { level: 'expert',       label: 'Expert',        color: '#eab308', minHours: 1000, minRating: 15, icon: 'star' },
  { level: 'advanced',     label: 'Advanced',      color: '#a855f7', minHours: 200,  minRating: 3,  icon: 'shield' },
  { level: 'intermediate', label: 'Intermediate',  color: '#3b82f6', minHours: 50,   minRating: 1,  icon: 'circle' },
  { level: 'beginner',     label: 'Beginner',      color: '#22c55e', minHours: 0,    minRating: 0,  icon: 'dot' },
];

/** Flight phase color mapping */
export const FLIGHT_PHASE_COLORS: Record<FlightPhase, string> = {
  preflight:  '#6b7280',
  ground:     '#94a3b8',
  departing:  '#38bdf8',
  climbing:   '#3b82f6',
  cruising:   '#3b82f6',
  descending: '#3b82f6',
  arriving:   '#f59e0b',
  landed:     '#94a3b8',
};
