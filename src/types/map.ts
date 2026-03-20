// ============================================================
// Map Configuration Types
// ============================================================

/** Map layer visibility state */
export interface MapLayerState {
  aircraft: boolean;
  airports: boolean;
  airspace: boolean;
  routes: boolean;
  weather: boolean;
  sigmet: boolean;
  dayNight: boolean;
}

/** Map settings persisted to localStorage */
export interface MapSettings {
  center: [number, number]; // [lng, lat]
  zoom: number;
  bearing: number;
  pitch: number;
  projection: 'mercator' | 'globe';
  layers: MapLayerState;
  weatherOpacity: number;
  showLabels: boolean;
  clusterAircraft: boolean;
  showExperienceBadges: boolean;
  showStreamingIndicators: boolean;
  theme: 'dark'; // only dark for V2
}

export const DEFAULT_MAP_SETTINGS: MapSettings = {
  center: [10, 48], // Central Europe
  zoom: 4,
  bearing: 0,
  pitch: 0,
  projection: 'mercator',
  layers: {
    aircraft: true,
    airports: true,
    airspace: false,
    routes: false,
    weather: false,
    sigmet: false,
    dayNight: false,
  },
  weatherOpacity: 0.5,
  showLabels: true,
  clusterAircraft: true,
  showExperienceBadges: true,
  showStreamingIndicators: true,
  theme: 'dark',
};

/** Aircraft icon mapping by ICAO type code prefix */
export type AircraftCategory =
  | 'single-prop'
  | 'twin-prop'
  | 'business-jet'
  | 'regional-jet'
  | 'narrow-body'
  | 'wide-body'
  | 'jumbo'
  | 'cargo'
  | 'helicopter'
  | 'military-fighter'
  | 'military-transport'
  | 'general-aviation'
  | 'unknown';
