// ============================================================
// Phase 10: Map Engine Core
// MapLibre GL JS initialization, controls, layer management
// ============================================================

import maplibregl from 'maplibre-gl';
import type { Map as MaplibreMap } from 'maplibre-gl';
import { createDarkAviationStyle } from './styles';
import type { MapSettings } from '@/types';
import { DEFAULT_MAP_SETTINGS } from '@/types';

// ---- Configuration ----

const SETTINGS_KEY = 'skybrief-radar-v2-map-settings';

// ---- Types ----

export interface MapEngine {
  map: MaplibreMap;
  destroy: () => void;
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  getCenter: () => [number, number];
  getZoom: () => number;
  toggleGlobe: () => void;
  isGlobe: () => boolean;
  toggleFullscreen: () => void;
  onReady: (callback: () => void) => void;
}

// ---- Settings Persistence ----

function loadSettings(): MapSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_MAP_SETTINGS;
    const parsed = { ...DEFAULT_MAP_SETTINGS, ...JSON.parse(raw) };
    // Force mercator — globe doesn't work well with raster tiles
    parsed.projection = 'mercator';
    return parsed;
  } catch {
    return DEFAULT_MAP_SETTINGS;
  }
}

function saveSettings(map: MaplibreMap, settings: MapSettings): void {
  try {
    const center = map.getCenter();
    const updated: MapSettings = {
      ...settings,
      center: [center.lng, center.lat],
      zoom: map.getZoom(),
      bearing: map.getBearing(),
      pitch: map.getPitch(),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

// ---- Map Initialization ----

/**
 * Initialize the MapLibre GL JS map engine.
 * Returns a MapEngine interface for controlling the map.
 */
export function initMapEngine(container: string | HTMLElement): MapEngine {
  const settings = loadSettings();

  const map = new maplibregl.Map({
    container,
    style: createDarkAviationStyle(),
    center: settings.center,
    zoom: settings.zoom,
    bearing: settings.bearing,
    pitch: settings.pitch,
    minZoom: 2,
    maxZoom: 20,
    attributionControl: false,
    hash: false,
  });

  // Error logging
  map.on('error', (e) => {
    console.error('[Map Error]', e.error?.message || e);
  });

  // Set projection
  if (settings.projection === 'globe') {
    map.setProjection({ type: 'globe' });
  }

  // ---- Custom Controls ----

  // Navigation (zoom + compass)
  const nav = new maplibregl.NavigationControl({
    showCompass: true,
    showZoom: true,
    visualizePitch: true,
  });
  map.addControl(nav, 'bottom-right');

  // Scale bar
  map.addControl(new maplibregl.ScaleControl({
    maxWidth: 150,
    unit: 'nautical',
  }), 'bottom-left');

  // Attribution (small)
  map.addControl(new maplibregl.AttributionControl({
    compact: true,
  }), 'bottom-left');

  // ---- Globe Atmosphere (when in globe mode) ----

  map.on('style.load', () => {
    if (settings.projection === 'globe') {
      applyGlobeAtmosphere(map);
    }
  });

  // ---- Persist settings on move ----

  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveSettings(map, settings), 1000);
  };

  map.on('moveend', debouncedSave);
  map.on('zoomend', debouncedSave);

  // ---- State ----

  let currentProjection: 'mercator' | 'globe' = settings.projection;
  let readyCallbacks: (() => void)[] = [];
  let isReady = false;

  map.on('load', () => {
    isReady = true;
    for (const cb of readyCallbacks) cb();
    readyCallbacks = [];
  });

  // ---- Engine API ----

  const engine: MapEngine = {
    map,

    destroy() {
      if (saveTimeout) clearTimeout(saveTimeout);
      saveSettings(map, settings);
      map.remove();
    },

    flyTo(lng: number, lat: number, zoom?: number) {
      map.flyTo({
        center: [lng, lat],
        zoom: zoom ?? map.getZoom(),
        duration: 1500,
        essential: true,
      });
    },

    getCenter(): [number, number] {
      const c = map.getCenter();
      return [c.lng, c.lat];
    },

    getZoom(): number {
      return map.getZoom();
    },

    toggleGlobe() {
      if (currentProjection === 'globe') {
        currentProjection = 'mercator';
        map.setProjection({ type: 'mercator' });
        removeGlobeAtmosphere(map);
      } else {
        currentProjection = 'globe';
        map.setProjection({ type: 'globe' });
        applyGlobeAtmosphere(map);
      }
      settings.projection = currentProjection;
      saveSettings(map, settings);
    },

    isGlobe(): boolean {
      return currentProjection === 'globe';
    },

    toggleFullscreen() {
      const el = map.getContainer();
      if (!document.fullscreenElement) {
        el.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    },

    onReady(callback: () => void) {
      if (isReady) {
        callback();
      } else {
        readyCallbacks.push(callback);
      }
    },
  };

  return engine;
}

// ---- Globe Atmosphere Effect ----

function applyGlobeAtmosphere(map: MaplibreMap): void {
  try {
    (map as any).setFog?.({
      color: '#0a0e27',
      'high-color': '#0d1535',
      'horizon-blend': 0.05,
      'space-color': '#050816',
      'star-intensity': 0.6,
    });
  } catch {
    // Fog/atmosphere not supported in all versions
  }
}

function removeGlobeAtmosphere(map: MaplibreMap): void {
  try {
    (map as any).setFog?.(null);
  } catch {
    // Ignore
  }
}
