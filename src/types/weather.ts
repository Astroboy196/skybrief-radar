// ============================================================
// Weather Data Types
// Sources: AviationWeather.gov, RainViewer, VATSIM METAR API
// ============================================================

/** Decoded METAR data */
export interface DecodedMetar {
  icao: string;
  raw: string;
  observationTime: string;
  wind: {
    direction: number | null;
    speed: number;
    gust: number | null;
    variable: boolean;
  };
  visibility: {
    meters: number;
    statute: number;
  };
  ceiling: number | null;
  temperature: number;
  dewpoint: number;
  altimeter: {
    hpa: number;
    inhg: number;
  };
  flightRules: FlightRules;
  clouds: CloudLayer[];
  conditions: WeatherCondition[];
}

export type FlightRules = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface CloudLayer {
  coverage: 'FEW' | 'SCT' | 'BKN' | 'OVC' | 'CLR' | 'SKC' | 'NCD';
  altitude: number; // feet AGL
  type?: 'CB' | 'TCU';
}

export interface WeatherCondition {
  intensity: '+' | '-' | '' | 'VC';
  descriptor: string;
  precipitation: string;
}

/** Flight rules color mapping */
export const FLIGHT_RULES_COLORS: Record<FlightRules, string> = {
  VFR:  '#22c55e', // green
  MVFR: '#3b82f6', // blue
  IFR:  '#ef4444', // red
  LIFR: '#d946ef', // magenta
};

// ============================================================
// SIGMET / AIRMET Types
// Source: AviationWeather.gov /api/data/airsigmet
// ============================================================

export interface SigmetData {
  id: string;
  type: 'SIGMET' | 'AIRMET' | 'CWA';
  hazard: SigmetHazard;
  severity: 'NONE' | 'LIGHT' | 'MODERATE' | 'SEVERE' | 'EXTREME';
  validFrom: string;
  validTo: string;
  altitudeLow: number | null;
  altitudeHigh: number | null;
  rawText: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
}

export type SigmetHazard =
  | 'TURB'          // Turbulence
  | 'ICE'           // Icing
  | 'IFR'           // IFR conditions
  | 'MTN_OBSCN'     // Mountain obscuration
  | 'TS'            // Thunderstorms
  | 'VA'            // Volcanic ash
  | 'TC'            // Tropical cyclone
  | 'SS'            // Sandstorm
  | 'OTHER';

export const SIGMET_COLORS: Record<SigmetHazard, string> = {
  TURB:       '#f97316', // orange
  ICE:        '#06b6d4', // cyan
  IFR:        '#ef4444', // red
  MTN_OBSCN:  '#8b5cf6', // violet
  TS:         '#eab308', // yellow
  VA:         '#6b7280', // gray
  TC:         '#ec4899', // pink
  SS:         '#a3a3a3', // light gray
  OTHER:      '#6b7280',
};

// ============================================================
// RainViewer Types
// Source: https://api.rainviewer.com/public/weather-maps.json
// ============================================================

export interface RainViewerData {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast: RainViewerFrame[];
  };
  satellite: {
    infrared: RainViewerFrame[];
  };
}

export interface RainViewerFrame {
  time: number; // Unix timestamp
  path: string; // Tile path template
}
