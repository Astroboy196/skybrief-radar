// ============================================================
// Phase 15: Weather Overlay System
// RainViewer radar tiles, SIGMET polygons, animation controls
// ============================================================

import type { Map as MaplibreMap } from 'maplibre-gl';
import type { RainViewerData, RainViewerFrame, SigmetData } from '@/types';
import { SIGMET_COLORS } from '@/types';
import { fetchRainViewerData, getRadarFrames, buildRainViewerTileUrl, fetchSigmets } from '@/data/weather-api';

// ---- Configuration ----

const RADAR_SOURCE_ID = 'rainviewer-source';
const RADAR_LAYER_ID = 'rainviewer-layer';
const SIGMET_SOURCE_ID = 'sigmet-source';
const SIGMET_FILL_LAYER_ID = 'sigmet-fill';
const SIGMET_OUTLINE_LAYER_ID = 'sigmet-outline';
const RADAR_REFRESH_MS = 2 * 60 * 1000; // 2 minutes

// ---- State ----

let radarData: RainViewerData | null = null;
let radarFrames: RainViewerFrame[] = [];
let currentFrameIndex = 0;
let isAnimating = false;
let animationTimer: ReturnType<typeof setInterval> | null = null;
let radarRefreshTimer: ReturnType<typeof setInterval> | null = null;
let radarOpacity = 0.5;
let radarVisible = false;
let sigmetVisible = false;

// ---- Radar Layer ----

/**
 * Initialize the weather overlay layers on the map.
 */
export function initWeatherLayers(map: MaplibreMap): void {
  // Empty raster source for radar (will be updated with tile URL)
  map.addSource(RADAR_SOURCE_ID, {
    type: 'raster',
    tiles: ['https://tilecache.rainviewer.com/v2/radar/0/256/{z}/{x}/{y}/2/1_1.png'],
    tileSize: 256,
  });

  map.addLayer({
    id: RADAR_LAYER_ID,
    type: 'raster',
    source: RADAR_SOURCE_ID,
    paint: {
      'raster-opacity': 0,
      'raster-fade-duration': 0,
    },
    layout: {
      visibility: 'none',
    },
  }, 'aircraft-layer'); // Insert BELOW aircraft layers

  // SIGMET GeoJSON source
  map.addSource(SIGMET_SOURCE_ID, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // SIGMET fill layer
  map.addLayer({
    id: SIGMET_FILL_LAYER_ID,
    type: 'fill',
    source: SIGMET_SOURCE_ID,
    layout: {
      visibility: 'none',
    },
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.15,
    },
  }, 'aircraft-layer');

  // SIGMET outline layer
  map.addLayer({
    id: SIGMET_OUTLINE_LAYER_ID,
    type: 'line',
    source: SIGMET_SOURCE_ID,
    layout: {
      visibility: 'none',
    },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 1.5,
      'line-opacity': 0.6,
      'line-dasharray': [4, 2],
    },
  }, 'aircraft-layer');

  // SIGMET hover popup
  map.on('mouseenter', SIGMET_FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = 'help';
  });

  map.on('mouseleave', SIGMET_FILL_LAYER_ID, () => {
    map.getCanvas().style.cursor = '';
  });

  console.log('[Weather] Layers initialized');
}

// ---- Radar Control ----

/**
 * Show/hide the precipitation radar overlay.
 */
export async function toggleRadar(map: MaplibreMap, visible?: boolean): Promise<void> {
  radarVisible = visible ?? !radarVisible;

  if (radarVisible) {
    // Fetch data if not loaded
    if (!radarData) {
      radarData = await fetchRainViewerData();
      if (radarData) {
        radarFrames = getRadarFrames(radarData);
        currentFrameIndex = radarFrames.length - 1; // Most recent
        updateRadarTiles(map);
      }
    }

    map.setLayoutProperty(RADAR_LAYER_ID, 'visibility', 'visible');
    map.setPaintProperty(RADAR_LAYER_ID, 'raster-opacity', radarOpacity);

    // Start auto-refresh
    if (!radarRefreshTimer) {
      radarRefreshTimer = setInterval(async () => {
        radarData = await fetchRainViewerData();
        if (radarData) {
          radarFrames = getRadarFrames(radarData);
          if (!isAnimating) {
            currentFrameIndex = radarFrames.length - 1;
            updateRadarTiles(map);
          }
        }
      }, RADAR_REFRESH_MS);
    }
  } else {
    map.setLayoutProperty(RADAR_LAYER_ID, 'visibility', 'none');
    map.setPaintProperty(RADAR_LAYER_ID, 'raster-opacity', 0);
    stopRadarAnimation();

    if (radarRefreshTimer) {
      clearInterval(radarRefreshTimer);
      radarRefreshTimer = null;
    }
  }
}

/**
 * Set radar overlay opacity (0-1).
 */
export function setRadarOpacity(map: MaplibreMap, opacity: number): void {
  radarOpacity = Math.max(0, Math.min(1, opacity));
  if (radarVisible) {
    map.setPaintProperty(RADAR_LAYER_ID, 'raster-opacity', radarOpacity);
  }
}

/**
 * Update the radar tile URL to show a specific frame.
 */
function updateRadarTiles(map: MaplibreMap): void {
  if (!radarData || radarFrames.length === 0) return;
  const frame = radarFrames[currentFrameIndex];
  if (!frame) return;

  const tileUrl = buildRainViewerTileUrl(frame, radarData.host);

  // Update the source tiles
  const source = map.getSource(RADAR_SOURCE_ID);
  if (source && 'setTiles' in source) {
    (source as any).setTiles([tileUrl]);
  }
}

// ---- Radar Animation ----

/**
 * Start/stop radar animation (loop through past frames).
 */
export function toggleRadarAnimation(map: MaplibreMap): void {
  if (isAnimating) {
    stopRadarAnimation();
  } else {
    startRadarAnimation(map);
  }
}

function startRadarAnimation(map: MaplibreMap): void {
  if (radarFrames.length === 0) return;
  isAnimating = true;
  currentFrameIndex = 0;

  animationTimer = setInterval(() => {
    currentFrameIndex = (currentFrameIndex + 1) % radarFrames.length;
    updateRadarTiles(map);
    updateTimestampDisplay();
  }, 800); // 800ms per frame
}

function stopRadarAnimation(): void {
  isAnimating = false;
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
  }
}

function updateTimestampDisplay(): void {
  const el = document.getElementById('radar-timestamp');
  if (!el || radarFrames.length === 0) return;

  const frame = radarFrames[currentFrameIndex];
  if (!frame) return;

  const date = new Date(frame.time * 1000);
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  el.textContent = time;
}

/**
 * Get current radar frame timestamp for display.
 */
export function getCurrentRadarTimestamp(): string {
  if (radarFrames.length === 0) return '--:--';
  const frame = radarFrames[currentFrameIndex];
  if (!frame) return '--:--';
  const date = new Date(frame.time * 1000);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get radar animation state.
 */
export function isRadarAnimating(): boolean {
  return isAnimating;
}

export function isRadarVisible(): boolean {
  return radarVisible;
}

// ---- SIGMET Layer ----

/**
 * Show/hide SIGMET polygons on the map.
 */
export async function toggleSigmets(map: MaplibreMap, visible?: boolean): Promise<void> {
  sigmetVisible = visible ?? !sigmetVisible;

  if (sigmetVisible) {
    const sigmets = await fetchSigmets();
    updateSigmetData(map, sigmets);

    map.setLayoutProperty(SIGMET_FILL_LAYER_ID, 'visibility', 'visible');
    map.setLayoutProperty(SIGMET_OUTLINE_LAYER_ID, 'visibility', 'visible');
  } else {
    map.setLayoutProperty(SIGMET_FILL_LAYER_ID, 'visibility', 'none');
    map.setLayoutProperty(SIGMET_OUTLINE_LAYER_ID, 'visibility', 'none');
  }
}

/**
 * Update SIGMET GeoJSON data on the map.
 */
function updateSigmetData(map: MaplibreMap, sigmets: SigmetData[]): void {
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: sigmets
      .filter(s => s.geometry.coordinates.length > 0 && s.geometry.coordinates[0].length > 0)
      .map(sigmet => ({
        type: 'Feature' as const,
        geometry: sigmet.geometry,
        properties: {
          id: sigmet.id,
          type: sigmet.type,
          hazard: sigmet.hazard,
          severity: sigmet.severity,
          color: SIGMET_COLORS[sigmet.hazard] || SIGMET_COLORS.OTHER,
          rawText: sigmet.rawText,
          altLow: sigmet.altitudeLow,
          altHigh: sigmet.altitudeHigh,
          validFrom: sigmet.validFrom,
          validTo: sigmet.validTo,
        },
      })),
  };

  const source = map.getSource(SIGMET_SOURCE_ID);
  if (source && 'setData' in source) {
    (source as any).setData(geojson);
  }
}

export function isSigmetVisible(): boolean {
  return sigmetVisible;
}

// ---- Cleanup ----

/**
 * Remove all weather layers and stop timers.
 */
export function removeWeatherLayers(map: MaplibreMap): void {
  stopRadarAnimation();

  if (radarRefreshTimer) {
    clearInterval(radarRefreshTimer);
    radarRefreshTimer = null;
  }

  for (const id of [SIGMET_OUTLINE_LAYER_ID, SIGMET_FILL_LAYER_ID, RADAR_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of [SIGMET_SOURCE_ID, RADAR_SOURCE_ID]) {
    if (map.getSource(id)) map.removeSource(id);
  }
}
