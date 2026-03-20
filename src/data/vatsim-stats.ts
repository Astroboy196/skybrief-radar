// ============================================================
// Phase 4: VATSIM Stats & Member API
// Fetches pilot hours, ratings, with caching + batch loading
// Source: GET /v2/members/:member_id/stats
// ============================================================

import type { VatsimMemberStats } from '@/types';

// ---- Configuration ----

const IS_DEV = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const STATS_BASE_URL = IS_DEV ? '/api/vatsim-stats/v2/members' : 'https://api.vatsim.net/v2/members';
const CACHE_TTL_MS = 5 * 60 * 1000;        // 5 minutes
const MAX_CONCURRENT_REQUESTS = 10;
const REQUEST_TIMEOUT_MS = 8_000;           // 8 seconds per request
const BATCH_DELAY_MS = 100;                 // Delay between batch items

// ---- Types ----

interface CachedStats {
  stats: VatsimMemberStats;
  fetchedAt: number;
}

interface QueueItem {
  cid: number;
  resolve: (stats: VatsimMemberStats | null) => void;
}

// ---- Internal State ----

const cache = new Map<number, CachedStats>();
const pendingRequests = new Map<number, Promise<VatsimMemberStats | null>>();
const queue: QueueItem[] = [];
let isProcessing = false;

// ---- Cache Management ----

/**
 * Check if a cached entry is still valid (within TTL).
 */
function isCacheValid(entry: CachedStats): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

/**
 * Get stats from cache if valid.
 */
export function getCachedStats(cid: number): VatsimMemberStats | null {
  const entry = cache.get(cid);
  if (entry && isCacheValid(entry)) {
    return entry.stats;
  }
  return null;
}

/**
 * Store stats in cache.
 */
function setCachedStats(cid: number, stats: VatsimMemberStats): void {
  cache.set(cid, { stats, fetchedAt: Date.now() });
}

/**
 * Clear expired entries from cache.
 */
export function clearExpiredCache(): number {
  let cleared = 0;
  for (const [cid, entry] of cache) {
    if (!isCacheValid(entry)) {
      cache.delete(cid);
      cleared++;
    }
  }
  return cleared;
}

/**
 * Get current cache size.
 */
export function getCacheSize(): number {
  return cache.size;
}

// ---- Single Fetch ----

/**
 * Fetch stats for a single CID from the API.
 * Returns null on error (graceful degradation).
 */
async function fetchStatsFromApi(cid: number): Promise<VatsimMemberStats | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(`${STATS_BASE_URL}/${cid}/stats`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        // Valid CID but no stats — return zeroed stats
        return createEmptyStats(cid);
      }
      return null;
    }

    const data = await response.json();
    return validateStats(cid, data);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`[Stats API] Request timed out for CID ${cid}`);
    } else {
      console.warn(`[Stats API] Failed to fetch stats for CID ${cid}:`, error);
    }
    return null;
  }
}

/**
 * Validate and normalize stats response.
 */
export function validateStats(cid: number, data: unknown): VatsimMemberStats | null {
  if (!data || typeof data !== 'object') return null;

  const raw = data as Record<string, unknown>;

  return {
    id: String(raw.id ?? cid),
    atc: toPositiveNumber(raw.atc),
    pilot: toPositiveNumber(raw.pilot),
    s1: toPositiveNumber(raw.s1),
    s2: toPositiveNumber(raw.s2),
    s3: toPositiveNumber(raw.s3),
    c1: toPositiveNumber(raw.c1),
    c2: toPositiveNumber(raw.c2),
    c3: toPositiveNumber(raw.c3),
    i1: toPositiveNumber(raw.i1),
    i2: toPositiveNumber(raw.i2),
    i3: toPositiveNumber(raw.i3),
    sup: toPositiveNumber(raw.sup),
    adm: toPositiveNumber(raw.adm),
  };
}

function toPositiveNumber(value: unknown): number {
  const num = Number(value);
  return isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
}

function createEmptyStats(cid: number): VatsimMemberStats {
  return {
    id: String(cid),
    atc: 0, pilot: 0,
    s1: 0, s2: 0, s3: 0,
    c1: 0, c2: 0, c3: 0,
    i1: 0, i2: 0, i3: 0,
    sup: 0, adm: 0,
  };
}

// ---- Batch Queue Processing ----

/**
 * Process the batch queue with concurrency limiting.
 */
async function processQueue(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    // Take up to MAX_CONCURRENT_REQUESTS items
    const batch = queue.splice(0, MAX_CONCURRENT_REQUESTS);

    const promises = batch.map(async (item) => {
      const stats = await fetchStatsFromApi(item.cid);
      if (stats) {
        setCachedStats(item.cid, stats);
      }
      item.resolve(stats);
    });

    await Promise.allSettled(promises);

    // Small delay between batches to avoid hammering the API
    if (queue.length > 0) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  isProcessing = false;
}

// ---- Public API ----

/**
 * Get stats for a CID. Returns cached data if available,
 * otherwise fetches from API. Deduplicates concurrent requests.
 */
export async function getStats(cid: number): Promise<VatsimMemberStats | null> {
  // 1. Check cache first
  const cached = getCachedStats(cid);
  if (cached) return cached;

  // 2. Check if request is already in flight
  const pending = pendingRequests.get(cid);
  if (pending) return pending;

  // 3. Create new request
  const promise = fetchStatsFromApi(cid).then(stats => {
    pendingRequests.delete(cid);
    if (stats) setCachedStats(cid, stats);
    return stats;
  });

  pendingRequests.set(cid, promise);
  return promise;
}

/**
 * Batch-load stats for multiple CIDs.
 * Prioritizes CIDs that aren't cached yet.
 * Returns a map of CID → Stats (or null).
 */
export async function batchGetStats(cids: number[]): Promise<Map<number, VatsimMemberStats | null>> {
  const results = new Map<number, VatsimMemberStats | null>();
  const toFetch: number[] = [];

  // Check cache first for all CIDs
  for (const cid of cids) {
    const cached = getCachedStats(cid);
    if (cached) {
      results.set(cid, cached);
    } else {
      toFetch.push(cid);
    }
  }

  // Queue uncached CIDs
  if (toFetch.length > 0) {
    const fetchPromises = toFetch.map(cid => {
      return new Promise<void>(resolve => {
        queue.push({
          cid,
          resolve: (stats) => {
            results.set(cid, stats);
            resolve();
          },
        });
      });
    });

    // Start processing and wait
    processQueue();
    await Promise.allSettled(fetchPromises);
  }

  return results;
}

/**
 * Get total pilot hours for a CID (convenience).
 */
export async function getPilotHours(cid: number): Promise<number | null> {
  const stats = await getStats(cid);
  return stats?.pilot ?? null;
}

/**
 * Clear all cached data (for testing).
 */
export function _clearCache(): void {
  cache.clear();
  pendingRequests.clear();
  queue.length = 0;
  isProcessing = false;
}
