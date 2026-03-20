import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  validateStats,
  getCachedStats,
  getCacheSize,
  clearExpiredCache,
  getStats,
  batchGetStats,
  getPilotHours,
  _clearCache,
} from './vatsim-stats';

// ---- Mock Data ----

const MOCK_STATS_RESPONSE = {
  id: '1234567',
  atc: 156.5,
  pilot: 2847.3,
  s1: 50.2,
  s2: 106.3,
  s3: 0,
  c1: 0,
  c2: 0,
  c3: 0,
  i1: 0,
  i2: 0,
  i3: 0,
  sup: 0,
  adm: 0,
};

// ---- Setup ----

beforeEach(() => {
  _clearCache();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---- Validation Tests ----

describe('validateStats', () => {
  it('should validate a correct stats response', () => {
    const stats = validateStats(1234567, MOCK_STATS_RESPONSE);
    expect(stats).not.toBeNull();
    expect(stats!.id).toBe('1234567');
    expect(stats!.pilot).toBe(2847.3);
    expect(stats!.atc).toBe(156.5);
    expect(stats!.s1).toBe(50.2);
    expect(stats!.s2).toBe(106.3);
  });

  it('should return null for null input', () => {
    expect(validateStats(123, null)).toBeNull();
  });

  it('should return null for non-object input', () => {
    expect(validateStats(123, 'string')).toBeNull();
    expect(validateStats(123, 42)).toBeNull();
  });

  it('should handle missing fields with 0 defaults', () => {
    const stats = validateStats(123, { id: '123' });
    expect(stats).not.toBeNull();
    expect(stats!.pilot).toBe(0);
    expect(stats!.atc).toBe(0);
    expect(stats!.s1).toBe(0);
  });

  it('should handle negative values by clamping to 0', () => {
    const stats = validateStats(123, { pilot: -100, atc: -50 });
    expect(stats!.pilot).toBe(0);
    expect(stats!.atc).toBe(0);
  });

  it('should handle NaN values by defaulting to 0', () => {
    const stats = validateStats(123, { pilot: 'not-a-number', atc: undefined });
    expect(stats!.pilot).toBe(0);
    expect(stats!.atc).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    const stats = validateStats(123, { pilot: 1234.5678 });
    expect(stats!.pilot).toBe(1234.57);
  });

  it('should use CID as fallback id', () => {
    const stats = validateStats(999, {});
    expect(stats!.id).toBe('999');
  });
});

// ---- Cache Tests ----

describe('Cache Management', () => {
  it('should return null for uncached CID', () => {
    expect(getCachedStats(99999)).toBeNull();
  });

  it('should start with empty cache', () => {
    expect(getCacheSize()).toBe(0);
  });

  it('should track cache size after getStats calls', async () => {
    // Mock fetch to return valid stats
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_STATS_RESPONSE),
    }));

    await getStats(1234567);
    expect(getCacheSize()).toBe(1);

    await getStats(7654321);
    expect(getCacheSize()).toBe(2);
  });

  it('should return cached data without refetching', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_STATS_RESPONSE),
    });
    vi.stubGlobal('fetch', mockFetch);

    // First call — fetches from API
    await getStats(1234567);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call — should use cache
    const cached = await getStats(1234567);
    expect(mockFetch).toHaveBeenCalledTimes(1); // No additional fetch
    expect(cached!.pilot).toBe(2847.3);
  });

  it('should clear expired entries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_STATS_RESPONSE),
    }));

    await getStats(111);
    await getStats(222);
    expect(getCacheSize()).toBe(2);

    // Mock time passing beyond TTL
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000); // 6 minutes
    const cleared = clearExpiredCache();
    expect(cleared).toBe(2);
    expect(getCacheSize()).toBe(0);
  });
});

// ---- API Fetch Tests ----

describe('getStats', () => {
  it('should fetch and return stats from API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_STATS_RESPONSE),
    }));

    const stats = await getStats(1234567);
    expect(stats).not.toBeNull();
    expect(stats!.pilot).toBe(2847.3);
    expect(stats!.atc).toBe(156.5);
  });

  it('should return empty stats for 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }));

    const stats = await getStats(9999999);
    expect(stats).not.toBeNull();
    expect(stats!.pilot).toBe(0);
    expect(stats!.atc).toBe(0);
  });

  it('should return null for server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const stats = await getStats(1234567);
    expect(stats).toBeNull();
  });

  it('should return null for network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const stats = await getStats(1234567);
    expect(stats).toBeNull();
  });

  it('should deduplicate concurrent requests for same CID', async () => {
    let resolvePromise: () => void;
    const delayedResponse = new Promise<void>(r => { resolvePromise = r; });

    const mockFetch = vi.fn().mockImplementation(async () => {
      await delayedResponse;
      return { ok: true, json: () => Promise.resolve(MOCK_STATS_RESPONSE) };
    });
    vi.stubGlobal('fetch', mockFetch);

    // Launch two concurrent requests for same CID
    const promise1 = getStats(1234567);
    const promise2 = getStats(1234567);

    resolvePromise!();

    const [result1, result2] = await Promise.all([promise1, promise2]);

    // Should only have made ONE fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result1!.pilot).toBe(2847.3);
    expect(result2!.pilot).toBe(2847.3);
  });
});

// ---- Batch Loading Tests ----

describe('batchGetStats', () => {
  it('should fetch stats for multiple CIDs', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      const cid = url.split('/').slice(-2)[0];
      return {
        ok: true,
        json: () => Promise.resolve({ ...MOCK_STATS_RESPONSE, id: cid, pilot: callCount * 100 }),
      };
    }));

    const results = await batchGetStats([111, 222, 333]);
    expect(results.size).toBe(3);
    expect(results.get(111)).not.toBeNull();
    expect(results.get(222)).not.toBeNull();
    expect(results.get(333)).not.toBeNull();
  });

  it('should use cache for already cached CIDs', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_STATS_RESPONSE),
    });
    vi.stubGlobal('fetch', mockFetch);

    // Pre-cache CID 111
    await getStats(111);
    const initialCalls = mockFetch.mock.calls.length;

    // Batch with 111 (cached) + 222 (uncached)
    await batchGetStats([111, 222]);

    // Should only fetch 222, not 111 again
    expect(mockFetch).toHaveBeenCalledTimes(initialCalls + 1);
  });
});

// ---- Convenience Functions ----

describe('getPilotHours', () => {
  it('should return pilot hours for valid CID', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_STATS_RESPONSE),
    }));

    const hours = await getPilotHours(1234567);
    expect(hours).toBe(2847.3);
  });

  it('should return null for failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));

    const hours = await getPilotHours(1234567);
    expect(hours).toBeNull();
  });
});
