// ============================================================
// SkyBrief Radar V2 — Main Entry Point
// Phase 1 V2: All modules properly connected
// ============================================================

import 'maplibre-gl/dist/maplibre-gl.css';
import maplibregl from 'maplibre-gl';

document.addEventListener('DOMContentLoaded', () => {
  const loading = document.getElementById('loading');

  try {
    // ============================================================
    // STEP 1: Create Map
    // ============================================================
    const map = new maplibregl.Map({
      container: 'map',
      style: {
        version: 8,
        sources: {
          'carto': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [{ id: 'carto-layer', type: 'raster', source: 'carto' }],
        glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
      },
      center: [8.5, 47.4],
      zoom: 5,
      attributionControl: false,
    });

    map.on('error', (e) => console.error('[Map Error]', e));

    map.on('load', async () => {
      console.log('[Radar V2] Map loaded');
      if (loading) loading.style.display = 'none';

      // ============================================================
      // STEP 2: Import ALL modules
      // ============================================================
      const { initAircraftLayer, updateAircraftData, onAircraftClick, startInterpolation } = await import('./map/layers/aircraft');
      const { initAtcLayer, updateAtcData } = await import('./map/layers/atc');
      const { initSectorLayer, updateSectors, onSectorClick } = await import('./map/layers/sectors');
      const { initWeatherLayers } = await import('./map/layers/weather');
      const { startPolling, onDataUpdate, getPilotByCallsign } = await import('./data/vatsim-api');
      const { batchGetStats } = await import('./data/vatsim-stats');
      const { enrichAllPilots, buildGeoJson, cleanupOfflinePilots } = await import('./data/pilot-pipeline');
      const { buildAllStreamingStatuses } = await import('./social/streaming');
      const { getProfilesMap } = await import('./social/profile-store');
      const { showPilotCard, isPilotCardOpen, getCurrentPilotCid, closePilotCard } = await import('./ui/pilot-card');
      const { showAirportPanel } = await import('./ui/airport-panel');
      const { createSearchBar } = await import('./ui/toolbar');
      const { createLeftToolbar } = await import('./ui/left-toolbar');
      const { createRightControls } = await import('./ui/right-controls');
      const { initRouteLayer, showRoute, clearRoute, updateRoute, fitRouteInView, getRoutePilotCid } = await import('./map/layers/route');
      const { initHoverTooltip } = await import('./map/layers/hover-tooltip');
      const { initAirportLayer, updateAirportData, onAirportClick } = await import('./map/layers/airports');

      const overlay = document.getElementById('ui-overlay')!;
      let enrichedPilotsMap = new Map<number, import('./types').EnrichedPilot>();
      let latestGeoJson: import('./data/pilot-pipeline').PilotGeoJsonCollection | null = null;
      const previousPositions = new Map<number, { lat: number; lng: number; heading: number }>();

      // ============================================================
      // STEP 3: Init ALL layers (order: sectors → atc → weather → aircraft)
      // ============================================================
      // Layer order: added LAST = rendered ON TOP
      // Bottom layers first, top layers last
      initAirportLayer(map);         // 1. Airport dots (bottom)
      await initSectorLayer(map);    // 2. Sector boundaries
      initWeatherLayers(map);        // 3. Weather overlays
      initAircraftLayer(map);        // 4. Aircraft icons
      initRouteLayer(map);           // 5. Route lines
      initAtcLayer(map);             // 6. ATC labels (ON TOP of everything)
      initHoverTooltip(map);         // 7. Tooltip (popup, not a layer)

      // Airport Click → Airport Panel
      onAirportClick((icao) => showAirportPanel(icao, overlay));

      console.log('[Radar V2] All layers initialized');

      // ============================================================
      // STEP 4: Init ALL UI components
      // ============================================================

      // 4a. Left Toolbar (Settings, Layer Toggles, Weather, Radar)
      createLeftToolbar(map, overlay);

      // 4b. Right Controls (Globe, Fullscreen, Locate, Reset)
      createRightControls(map, overlay);

      // 4c. Search Bar (Ctrl+K)
      createSearchBar(overlay,
        (callsign) => {
          const pilot = getPilotByCallsign(callsign);
          if (pilot) {
            map.flyTo({ center: [pilot.longitude, pilot.latitude], zoom: Math.max(map.getZoom(), 10) });
            const enriched = enrichedPilotsMap.get(pilot.cid);
            if (enriched) showPilotCard(enriched, overlay);
          }
        },
        (icao) => showAirportPanel(icao, overlay),
      );

      // 4d. Status Bar (bottom center)
      createStatusBar(overlay);

      // 4e. MapLibre Nav Controls (zoom/compass bottom-right)
      map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 150, unit: 'nautical' }), 'bottom-left');

      console.log('[Radar V2] All UI components initialized');

      // ============================================================
      // STEP 5: Event Handlers
      // ============================================================

      // 5a. Aircraft Click → Pilot Card + Route
      onAircraftClick((props, _lngLat) => {
        const pilot = enrichedPilotsMap.get(props.cid);
        if (pilot) {
          showPilotCard(pilot, overlay);
          showRoute(map, pilot);
          fitRouteInView(map, pilot);
        }
      });

      // 5c. Pilot Card Close → Clear Route
      const { onPilotCardClose } = await import('./ui/pilot-card');
      onPilotCardClose(() => clearRoute(map));

      // 5b. Sector Click → Controller Popup
      onSectorClick((info) => {
        showSectorPopup(info, overlay);
      });

      // ============================================================
      // STEP 6: Smooth Aircraft Interpolation
      // ============================================================
      startInterpolation(
        map,
        () => latestGeoJson,
        () => previousPositions,
      );
      console.log('[Radar V2] Interpolation started');

      // ============================================================
      // STEP 7: Start Data Polling + Update Loop
      // ============================================================
      startPolling();

      onDataUpdate((state) => {
        // 7a. Status Bar
        updateStatusBar(state.pilots.length, state.controllers.length, state.updateTimestamp);

        // 7b. Enrich pilots
        const profiles = getProfilesMap();
        const streamingStatuses = buildAllStreamingStatuses(state.pilots, profiles);
        const enrichedPilots = enrichAllPilots(state, { socialProfiles: profiles, streamingStatuses });
        enrichedPilotsMap = new Map(enrichedPilots.map(p => [p.cid, p]));

        // 7c. Store previous positions for interpolation
        for (const pilot of enrichedPilots) {
          previousPositions.set(pilot.cid, {
            lat: pilot.prevLatitude,
            lng: pilot.prevLongitude,
            heading: pilot.prevHeading,
          });
        }

        // 7d. Build GeoJSON + update aircraft layer
        latestGeoJson = buildGeoJson(enrichedPilots);
        updateAircraftData(map, latestGeoJson);

        // 7e. Update ATC labels + sectors + airports
        updateAtcData(map, state.controllers, state.atis);
        updateSectors(map, state.controllers);
        updateAirportData(map, state.pilots, state.controllers, state.atis);

        // 7f. Lazy-load stats for visible pilots
        batchGetStats(enrichedPilots.slice(0, 200).map(p => p.cid));

        // 7g. Cleanup offline pilots
        cleanupOfflinePilots(new Set(state.pilots.map(p => p.cid)));

        // 7h. Update open Pilot Card + Route with fresh data
        if (isPilotCardOpen()) {
          const cid = getCurrentPilotCid();
          if (cid) {
            const updated = enrichedPilotsMap.get(cid);
            if (updated) {
              showPilotCard(updated, overlay);
              updateRoute(map, updated);
            } else {
              closePilotCard();
              clearRoute(map);
            }
          }
        }

        // 7i. Update route if pilot still selected but card closed
        const routeCid = getRoutePilotCid();
        if (routeCid && !isPilotCardOpen()) {
          clearRoute(map);
        }
      });

      console.log('[Radar V2] Data polling started — all systems online!');
    });

    // Cleanup
    window.addEventListener('beforeunload', () => map.remove());

  } catch (error) {
    console.error('[Radar V2] FATAL:', error);
    if (loading) {
      loading.innerHTML = `<div style="color:#ef4444;font-weight:bold;">Error: ${error instanceof Error ? error.message : error}</div>`;
    }
  }
});

// ============================================================
// Status Bar
// ============================================================

function createStatusBar(container: HTMLElement): void {
  const bar = document.createElement('div');
  bar.id = 'status-bar';
  Object.assign(bar.style, {
    position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(15,19,41,0.92)', backdropFilter: 'blur(16px)',
    border: '1px solid rgba(99,132,255,0.12)', borderRadius: '10px',
    padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '10px',
    fontSize: '12px', color: '#8892b0', pointerEvents: 'auto', zIndex: '10',
  });
  bar.innerHTML = `
    <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;"></span>
    <span id="status-pilots">-- Pilots</span>
    <span style="width:1px;height:10px;background:rgba(99,132,255,0.15);"></span>
    <span id="status-controllers">-- ATC</span>
    <span style="width:1px;height:10px;background:rgba(99,132,255,0.15);"></span>
    <span id="status-update">--:--</span>
  `;
  container.appendChild(bar);
}

function updateStatusBar(pilots: number, controllers: number, timestamp: string): void {
  const pe = document.getElementById('status-pilots');
  const ce = document.getElementById('status-controllers');
  const ue = document.getElementById('status-update');
  if (pe) pe.textContent = `${pilots} Pilots`;
  if (ce) ce.textContent = `${controllers} ATC`;
  if (ue && timestamp) {
    ue.textContent = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

// ============================================================
// Sector Click Popup
// ============================================================

function showSectorPopup(info: { id: string; callsign: string; name: string; frequency: string; rating: string; logonTime: string }, container: HTMLElement): void {
  document.getElementById('sector-popup')?.remove();

  const popup = document.createElement('div');
  popup.id = 'sector-popup';
  Object.assign(popup.style, {
    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    background: 'rgba(15,19,41,0.95)', backdropFilter: 'blur(20px)',
    border: '1px solid rgba(234,88,12,0.3)', borderRadius: '14px',
    padding: '20px', minWidth: '300px', pointerEvents: 'auto', zIndex: '30',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  });

  const online = info.logonTime ? formatOnlineTime(info.logonTime) : '--';

  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:14px;">
      <div>
        <div style="font-size:18px;font-weight:800;color:#e2e8f0;letter-spacing:0.5px;">${info.callsign}</div>
        <div style="font-size:12px;color:#8892b0;margin-top:3px;">${info.name}</div>
      </div>
      <button id="sector-popup-close" style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.08);color:#8892b0;cursor:pointer;display:flex;align-items:center;justify-content:center;
        font-size:16px;transition:all 0.2s;">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 14px;">
        <div style="font-size:9px;color:#5a6380;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Frequency</div>
        <div style="font-size:16px;color:#ea580c;font-weight:700;margin-top:4px;font-family:monospace;">${info.frequency !== '199.998' ? info.frequency : 'N/A'}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 14px;">
        <div style="font-size:9px;color:#5a6380;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Rating</div>
        <div style="font-size:16px;color:#e2e8f0;font-weight:700;margin-top:4px;">${info.rating}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:10px 14px;grid-column:span 2;">
        <div style="font-size:9px;color:#5a6380;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;">Online</div>
        <div style="font-size:14px;color:#e2e8f0;margin-top:4px;">${online}</div>
      </div>
    </div>
  `;

  container.appendChild(popup);
  popup.querySelector('#sector-popup-close')?.addEventListener('click', () => popup.remove());
  document.addEventListener('keydown', function h(e) { if (e.key === 'Escape') { popup.remove(); document.removeEventListener('keydown', h); } });
}

function formatOnlineTime(iso: string): string {
  try {
    const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (d < 60) return `${d}m`;
    return `${Math.floor(d / 60)}h ${d % 60}m`;
  } catch { return '--'; }
}
