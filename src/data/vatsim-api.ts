// ============================================================
// Phase 3: VATSIM Data API Client
// Handles polling, parsing, caching of live network data
// Source: https://data.vatsim.net/v3/vatsim-data.json
// ============================================================

import type {
  VatsimDataFeed,
  VatsimPilot,
  VatsimController,
  VatsimAtis,
  VatsimTransceiverEntry,
} from '@/types';

// ---- Configuration ----

const POLL_INTERVAL_MS = 15_000;         // 15 seconds (VATSIM update cycle)
const TRANSCEIVER_POLL_INTERVAL_MS = 15_000;
const IS_DEV = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const DATA_URL = IS_DEV ? '/api/vatsim-data' : 'https://data.vatsim.net/v3/vatsim-data.json';
const TRANSCEIVER_URL = IS_DEV ? '/api/vatsim-transceivers' : 'https://data.vatsim.net/v3/transceivers-data.json';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

// ---- Types ----

export interface VatsimDataState {
  /** All online pilots */
  pilots: VatsimPilot[];
  /** All online controllers (excluding ATIS) */
  controllers: VatsimController[];
  /** All ATIS stations */
  atis: VatsimAtis[];
  /** Audio transceiver data per callsign */
  transceivers: Map<string, VatsimTransceiverEntry>;
  /** Last update timestamp from VATSIM */
  updateTimestamp: string;
  /** Total connected clients */
  connectedClients: number;
  /** Total unique users */
  uniqueUsers: number;
  /** Whether data has been loaded at least once */
  initialized: boolean;
  /** Last fetch error, if any */
  lastError: string | null;
}

export type DataUpdateCallback = (state: VatsimDataState) => void;

// ---- Internal State ----

let state: VatsimDataState = createEmptyState();
let pollTimer: ReturnType<typeof setInterval> | null = null;
let transceiverTimer: ReturnType<typeof setInterval> | null = null;
let listeners: DataUpdateCallback[] = [];
let isTabVisible = true;

function createEmptyState(): VatsimDataState {
  return {
    pilots: [],
    controllers: [],
    atis: [],
    transceivers: new Map(),
    updateTimestamp: '',
    connectedClients: 0,
    uniqueUsers: 0,
    initialized: false,
    lastError: null,
  };
}

// ---- Fetch with Retry ----

async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
    }
  }
  throw new Error('Unreachable');
}

// ---- Data Parsing ----

/**
 * Parse and validate a pilot object from the raw API response.
 * Ensures all required fields exist with correct types.
 */
export function parsePilot(raw: Record<string, unknown>): VatsimPilot | null {
  if (
    typeof raw.cid !== 'number' ||
    typeof raw.callsign !== 'string' ||
    typeof raw.latitude !== 'number' ||
    typeof raw.longitude !== 'number'
  ) {
    return null;
  }

  return {
    cid: raw.cid,
    name: String(raw.name ?? ''),
    callsign: raw.callsign,
    server: String(raw.server ?? ''),
    pilot_rating: Number(raw.pilot_rating ?? 0),
    military_rating: Number(raw.military_rating ?? 0),
    latitude: raw.latitude,
    longitude: raw.longitude,
    altitude: Number(raw.altitude ?? 0),
    groundspeed: Number(raw.groundspeed ?? 0),
    transponder: String(raw.transponder ?? '0000'),
    heading: Number(raw.heading ?? 0),
    qnh_i_hg: Number(raw.qnh_i_hg ?? 29.92),
    qnh_mb: Number(raw.qnh_mb ?? 1013),
    flight_plan: parseFlightPlan(raw.flight_plan),
    logon_time: String(raw.logon_time ?? ''),
    last_updated: String(raw.last_updated ?? ''),
  };
}

/**
 * Parse a flight plan object. Returns null if no plan filed.
 */
export function parseFlightPlan(raw: unknown): VatsimPilot['flight_plan'] {
  if (!raw || typeof raw !== 'object') return null;

  const fp = raw as Record<string, unknown>;
  return {
    flight_rules: (fp.flight_rules === 'V' ? 'V' : 'I'),
    aircraft: String(fp.aircraft ?? ''),
    aircraft_faa: String(fp.aircraft_faa ?? ''),
    aircraft_short: String(fp.aircraft_short ?? ''),
    departure: String(fp.departure ?? ''),
    arrival: String(fp.arrival ?? ''),
    alternate: String(fp.alternate ?? ''),
    deptime: String(fp.deptime ?? ''),
    enroute_time: String(fp.enroute_time ?? ''),
    fuel_time: String(fp.fuel_time ?? ''),
    remarks: String(fp.remarks ?? ''),
    route: String(fp.route ?? ''),
    revision_id: Number(fp.revision_id ?? 0),
    assigned_transponder: String(fp.assigned_transponder ?? ''),
  };
}

/**
 * Parse a controller object from the raw API response.
 */
export function parseController(raw: Record<string, unknown>): VatsimController | null {
  if (
    typeof raw.cid !== 'number' ||
    typeof raw.callsign !== 'string'
  ) {
    return null;
  }

  return {
    cid: raw.cid,
    name: String(raw.name ?? ''),
    callsign: raw.callsign,
    frequency: String(raw.frequency ?? '199.998'),
    facility: Number(raw.facility ?? 0),
    rating: Number(raw.rating ?? 0),
    server: String(raw.server ?? ''),
    visual_range: Number(raw.visual_range ?? 0),
    text_atis: Array.isArray(raw.text_atis) ? raw.text_atis.map(String) : null,
    logon_time: String(raw.logon_time ?? ''),
    last_updated: String(raw.last_updated ?? ''),
  };
}

/**
 * Parse ATIS data (same as controller + atis_code).
 */
export function parseAtis(raw: Record<string, unknown>): VatsimAtis | null {
  const controller = parseController(raw);
  if (!controller) return null;

  return {
    ...controller,
    atis_code: String(raw.atis_code ?? ''),
  };
}

/**
 * Extract stream URLs from flight plan remarks field.
 * Pilots often embed their Twitch/YouTube URLs in remarks.
 */
export function extractStreamUrls(remarks: string): { twitch?: string; youtube?: string } {
  const result: { twitch?: string; youtube?: string } = {};

  // Twitch URLs: twitch.tv/username or www.twitch.tv/username
  const twitchMatch = remarks.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]+)/i);
  if (twitchMatch) {
    result.twitch = twitchMatch[1].toLowerCase();
  }

  // YouTube URLs: youtube.com/c/channel or youtube.com/@handle or youtu.be/...
  const youtubeMatch = remarks.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:c\/|channel\/|@)([a-zA-Z0-9_-]+)|youtu\.be\/([a-zA-Z0-9_-]+))/i
  );
  if (youtubeMatch) {
    result.youtube = youtubeMatch[1] || youtubeMatch[2];
  }

  return result;
}

// ---- Core Fetch Functions ----

/**
 * Fetch and parse the main VATSIM data feed.
 */
async function fetchVatsimData(): Promise<void> {
  try {
    const response = await fetchWithRetry(DATA_URL);
    const data: VatsimDataFeed = await response.json();

    // Parse pilots with validation
    const pilots: VatsimPilot[] = [];
    for (const raw of data.pilots ?? []) {
      const pilot = parsePilot(raw as unknown as Record<string, unknown>);
      if (pilot) pilots.push(pilot);
    }

    // Parse controllers
    const controllers: VatsimController[] = [];
    for (const raw of data.controllers ?? []) {
      const ctrl = parseController(raw as unknown as Record<string, unknown>);
      if (ctrl) controllers.push(ctrl);
    }

    // Parse ATIS
    const atis: VatsimAtis[] = [];
    for (const raw of data.atis ?? []) {
      const a = parseAtis(raw as unknown as Record<string, unknown>);
      if (a) atis.push(a);
    }

    state = {
      ...state,
      pilots,
      controllers,
      atis,
      updateTimestamp: data.general?.update_timestamp ?? '',
      connectedClients: data.general?.connected_clients ?? 0,
      uniqueUsers: data.general?.unique_users ?? 0,
      initialized: true,
      lastError: null,
    };

    notifyListeners();
  } catch (error) {
    state = {
      ...state,
      lastError: error instanceof Error ? error.message : 'Unknown fetch error',
    };
    console.error('[VATSIM API] Fetch failed:', error);
    notifyListeners();
  }
}

/**
 * Fetch transceiver/audio data (active frequencies per pilot).
 */
async function fetchTransceiverData(): Promise<void> {
  try {
    const response = await fetchWithRetry(TRANSCEIVER_URL);
    const data: VatsimTransceiverEntry[] = await response.json();

    const map = new Map<string, VatsimTransceiverEntry>();
    for (const entry of data) {
      if (entry.callsign && Array.isArray(entry.transceivers)) {
        map.set(entry.callsign, entry);
      }
    }

    state = { ...state, transceivers: map };
    // No separate notify — transceiver data is merged during enrichment
  } catch (error) {
    console.error('[VATSIM API] Transceiver fetch failed:', error);
  }
}

// ---- Listener Management ----

function notifyListeners() {
  for (const callback of listeners) {
    try {
      callback(state);
    } catch (error) {
      console.error('[VATSIM API] Listener error:', error);
    }
  }
}

// ---- Tab Visibility ----

function setupVisibilityHandler() {
  if (typeof document === 'undefined') return;

  document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
    if (isTabVisible && state.initialized) {
      // Immediately fetch when tab becomes visible again
      fetchVatsimData();
      fetchTransceiverData();
    }
  });
}

// ---- Public API ----

/**
 * Start polling the VATSIM Data API.
 * Fetches immediately, then every 15 seconds.
 */
export function startPolling(): void {
  if (pollTimer) return; // Already polling

  setupVisibilityHandler();

  // Immediate first fetch
  fetchVatsimData();
  fetchTransceiverData();

  // Start intervals
  pollTimer = setInterval(() => {
    if (isTabVisible) fetchVatsimData();
  }, POLL_INTERVAL_MS);

  transceiverTimer = setInterval(() => {
    if (isTabVisible) fetchTransceiverData();
  }, TRANSCEIVER_POLL_INTERVAL_MS);
}

/**
 * Stop polling.
 */
export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (transceiverTimer) {
    clearInterval(transceiverTimer);
    transceiverTimer = null;
  }
}

/**
 * Subscribe to data updates.
 * Returns an unsubscribe function.
 */
export function onDataUpdate(callback: DataUpdateCallback): () => void {
  listeners.push(callback);
  // If data is already loaded, immediately notify
  if (state.initialized) {
    callback(state);
  }
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * Get current state snapshot.
 */
export function getState(): Readonly<VatsimDataState> {
  return state;
}

/**
 * Get a specific pilot by CID.
 */
export function getPilotByCid(cid: number): VatsimPilot | undefined {
  return state.pilots.find(p => p.cid === cid);
}

/**
 * Get a specific pilot by callsign.
 */
export function getPilotByCallsign(callsign: string): VatsimPilot | undefined {
  return state.pilots.find(p => p.callsign.toUpperCase() === callsign.toUpperCase());
}

/**
 * Get all controllers for a specific airport ICAO.
 */
export function getControllersForAirport(icao: string): VatsimController[] {
  const prefix = icao.toUpperCase();
  return state.controllers.filter(c => c.callsign.toUpperCase().startsWith(prefix));
}

/**
 * Get ATIS for a specific airport ICAO.
 */
export function getAtisForAirport(icao: string): VatsimAtis | undefined {
  const prefix = icao.toUpperCase();
  return state.atis.find(a => a.callsign.toUpperCase().startsWith(prefix));
}

/**
 * Get transceiver data for a callsign (active frequency info).
 */
export function getTransceiverForCallsign(callsign: string): VatsimTransceiverEntry | undefined {
  return state.transceivers.get(callsign);
}

/**
 * Get the active frequency (Hz) for a callsign, converted to MHz string.
 */
export function getActiveFrequency(callsign: string): string | null {
  const entry = state.transceivers.get(callsign);
  if (!entry?.transceivers?.length) return null;
  const freq = entry.transceivers[0].frequency;
  // Convert Hz to MHz (e.g., 118100000 → "118.100")
  return (freq / 1_000_000).toFixed(3);
}

/**
 * Reset state (useful for testing).
 */
export function _resetState(): void {
  stopPolling();
  state = createEmptyState();
  listeners = [];
}
