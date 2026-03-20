// ============================================================
// Phase 8: Stream Detection Engine
// Detects live streams from: Remarks parsing + Profile Store + Twitch API
// Merges all sources into unified StreamingStatus per pilot
// ============================================================

import type { StreamingStatus, VatsimPilot, SocialProfile } from '@/types';
import { extractStreamUrls } from '@/data/vatsim-api';

// ---- Configuration ----

const TWITCH_POLL_INTERVAL_MS = 60_000;  // 60 seconds
const TWITCH_BATCH_SIZE = 100;           // Twitch API max per request

// ---- Types ----

interface TwitchStreamResponse {
  data: TwitchStream[];
}

interface TwitchStream {
  user_login: string;
  user_name: string;
  title: string;
  viewer_count: number;
  thumbnail_url: string;
  type: 'live' | '';
}

export interface StreamDetectionConfig {
  twitchClientId?: string;
  twitchAccessToken?: string;
  enabled: boolean;
}

// ---- Internal State ----

let config: StreamDetectionConfig = { enabled: false };
let liveStatuses = new Map<string, TwitchStream>(); // keyed by lowercase username
let pollTimer: ReturnType<typeof setInterval> | null = null;
let knownStreamers = new Set<string>(); // all usernames to check

// ---- Remarks URL Parsing ----

/**
 * Parse Twitch/YouTube URLs from all online pilots' remarks.
 * Returns a Map of CID → { twitch?, youtube? }
 */
export function parseAllRemarksUrls(pilots: VatsimPilot[]): Map<number, { twitch?: string; youtube?: string }> {
  const results = new Map<number, { twitch?: string; youtube?: string }>();

  for (const pilot of pilots) {
    if (!pilot.flight_plan?.remarks) continue;
    const urls = extractStreamUrls(pilot.flight_plan.remarks);
    if (urls.twitch || urls.youtube) {
      results.set(pilot.cid, urls);
    }
  }

  return results;
}

// ---- Twitch URL Normalization ----

/**
 * Normalize various Twitch URL formats to a clean username.
 */
export function normalizeTwitchUsername(input: string): string {
  if (!input) return '';

  // Remove URL parts
  let username = input
    .replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '')
    .replace(/[?#/].*$/, '')  // Remove query params and trailing paths
    .trim()
    .toLowerCase();

  return username;
}

/**
 * Normalize YouTube handle/channel to a clean identifier.
 */
export function normalizeYoutubeHandle(input: string): string {
  if (!input) return '';

  let handle = input
    .replace(/^https?:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)?/i, '')
    .replace(/[?#/].*$/, '')
    .trim();

  return handle;
}

// ---- Twitch API Client ----

/**
 * Check live status for a batch of Twitch usernames.
 * Twitch Helix API allows up to 100 user_login params per request.
 */
async function checkTwitchLiveStatus(usernames: string[]): Promise<Map<string, TwitchStream>> {
  if (!config.twitchClientId || !config.twitchAccessToken || usernames.length === 0) {
    return new Map();
  }

  const results = new Map<string, TwitchStream>();

  // Process in batches of TWITCH_BATCH_SIZE
  for (let i = 0; i < usernames.length; i += TWITCH_BATCH_SIZE) {
    const batch = usernames.slice(i, i + TWITCH_BATCH_SIZE);
    const params = batch.map(u => `user_login=${encodeURIComponent(u)}`).join('&');

    try {
      const response = await fetch(`https://api.twitch.tv/helix/streams?${params}`, {
        headers: {
          'Client-ID': config.twitchClientId,
          'Authorization': `Bearer ${config.twitchAccessToken}`,
        },
      });

      if (!response.ok) {
        console.warn(`[Twitch API] HTTP ${response.status}`);
        continue;
      }

      const data: TwitchStreamResponse = await response.json();

      for (const stream of data.data) {
        if (stream.type === 'live') {
          results.set(stream.user_login.toLowerCase(), stream);
        }
      }
    } catch (error) {
      console.warn('[Twitch API] Failed to check live status:', error);
    }
  }

  return results;
}

// ---- Polling ----

async function pollTwitchStatuses(): Promise<void> {
  if (knownStreamers.size === 0) return;

  const usernames = Array.from(knownStreamers);
  liveStatuses = await checkTwitchLiveStatus(usernames);
}

// ---- Merge Engine ----

/**
 * Build unified streaming status for a pilot by merging all data sources.
 *
 * Priority order:
 * 1. Profile Store (user explicitly set their stream info)
 * 2. Remarks parsing (pilot embedded URL in flight plan)
 * 3. Auto-detection (username matches known streamer)
 *
 * Live status always comes from Twitch API regardless of source.
 */
export function buildStreamingStatus(
  _cid: number,
  socialProfile: SocialProfile | null,
  remarksUrls: { twitch?: string; youtube?: string } | undefined,
): StreamingStatus {
  // Determine Twitch username from best available source
  let twitchUsername = '';

  // Priority 1: Profile Store
  if (socialProfile?.twitch) {
    twitchUsername = normalizeTwitchUsername(socialProfile.twitch);
  }
  // Priority 2: Remarks
  else if (remarksUrls?.twitch) {
    twitchUsername = normalizeTwitchUsername(remarksUrls.twitch);
  }

  // Check if live on Twitch
  if (twitchUsername) {
    const liveStream = liveStatuses.get(twitchUsername);
    if (liveStream) {
      return {
        isLive: true,
        platform: 'twitch',
        username: twitchUsername,
        streamUrl: `https://twitch.tv/${twitchUsername}`,
        viewerCount: liveStream.viewer_count,
        title: liveStream.title,
        thumbnailUrl: liveStream.thumbnail_url
          .replace('{width}', '320')
          .replace('{height}', '180'),
      };
    }

    // Has Twitch but not live
    return {
      isLive: false,
      platform: 'twitch',
      username: twitchUsername,
      streamUrl: `https://twitch.tv/${twitchUsername}`,
      viewerCount: 0,
      title: '',
      thumbnailUrl: '',
    };
  }

  // YouTube (no live detection for now, just link)
  const youtubeHandle = socialProfile?.youtube
    || remarksUrls?.youtube
    || '';

  if (youtubeHandle) {
    return {
      isLive: false,
      platform: 'youtube',
      username: normalizeYoutubeHandle(youtubeHandle),
      streamUrl: `https://youtube.com/@${normalizeYoutubeHandle(youtubeHandle)}`,
      viewerCount: 0,
      title: '',
      thumbnailUrl: '',
    };
  }

  // No streaming info
  return {
    isLive: false,
    platform: 'none',
    username: '',
    streamUrl: '',
    viewerCount: 0,
    title: '',
    thumbnailUrl: '',
  };
}

/**
 * Build streaming statuses for all pilots.
 * Returns Map<CID, StreamingStatus>
 */
export function buildAllStreamingStatuses(
  pilots: VatsimPilot[],
  socialProfiles: Map<number, SocialProfile>,
): Map<number, StreamingStatus> {
  const remarksMap = parseAllRemarksUrls(pilots);
  const results = new Map<number, StreamingStatus>();

  // Collect all known Twitch usernames for polling
  const newStreamers = new Set<string>();

  for (const pilot of pilots) {
    const profile = socialProfiles.get(pilot.cid) ?? null;
    const remarks = remarksMap.get(pilot.cid);
    const status = buildStreamingStatus(pilot.cid, profile, remarks);

    if (status.username && status.platform === 'twitch') {
      newStreamers.add(status.username);
    }

    // Only include non-default statuses to save memory
    if (status.platform !== 'none') {
      results.set(pilot.cid, status);
    }
  }

  knownStreamers = newStreamers;
  return results;
}

// ---- Public API ----

/**
 * Configure the stream detection engine.
 */
export function configureStreaming(newConfig: StreamDetectionConfig): void {
  config = newConfig;

  if (config.enabled && config.twitchClientId) {
    startPolling();
  } else {
    stopPolling();
  }
}

/**
 * Start polling Twitch for live statuses.
 */
export function startPolling(): void {
  if (pollTimer) return;
  pollTwitchStatuses(); // Immediate first check
  pollTimer = setInterval(pollTwitchStatuses, TWITCH_POLL_INTERVAL_MS);
}

/**
 * Stop polling.
 */
export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/**
 * Get current count of known live streamers.
 */
export function getLiveStreamerCount(): number {
  return liveStatuses.size;
}

/**
 * Reset all state (for testing).
 */
export function _resetStreaming(): void {
  stopPolling();
  config = { enabled: false };
  liveStatuses = new Map();
  knownStreamers = new Set();
}

/**
 * Inject mock live statuses (for testing).
 */
export function _setMockLiveStatuses(statuses: Map<string, TwitchStream>): void {
  liveStatuses = statuses;
}
