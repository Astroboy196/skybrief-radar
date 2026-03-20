import { describe, it, expect } from 'vitest';
import {
  getExperienceLevel,
  getExperienceLevelConfig,
  getPilotRatingInfo,
  detectFlightPhase,
  haversineDistance,
  calculateEta,
  formatEta,
  formatHours,
} from './experience';

// ---- Experience Level Tests ----

describe('getExperienceLevel', () => {
  // Beginner cases
  it('P0 + 0 hours = beginner', () => {
    expect(getExperienceLevel(0, 0)).toBe('beginner');
  });

  it('P0 + 10 hours = beginner', () => {
    expect(getExperienceLevel(0, 10)).toBe('beginner');
  });

  it('P0 + 49 hours = beginner', () => {
    expect(getExperienceLevel(0, 49)).toBe('beginner');
  });

  it('P0 + null hours = beginner', () => {
    expect(getExperienceLevel(0, null)).toBe('beginner');
  });

  // Intermediate cases
  it('PPL (1) + 30 hours = intermediate (rating triggers)', () => {
    expect(getExperienceLevel(1, 30)).toBe('intermediate');
  });

  it('P0 + 50 hours = intermediate (hours trigger)', () => {
    expect(getExperienceLevel(0, 50)).toBe('intermediate');
  });

  it('PPL + 100 hours = intermediate', () => {
    expect(getExperienceLevel(1, 100)).toBe('intermediate');
  });

  it('P0 + 199 hours = intermediate', () => {
    expect(getExperienceLevel(0, 199)).toBe('intermediate');
  });

  // Advanced cases
  it('IR (3) + 50 hours = advanced (rating triggers)', () => {
    expect(getExperienceLevel(3, 50)).toBe('advanced');
  });

  it('P0 + 200 hours = advanced (hours trigger)', () => {
    expect(getExperienceLevel(0, 200)).toBe('advanced');
  });

  it('CMEL (7) + 100 hours = advanced', () => {
    expect(getExperienceLevel(7, 100)).toBe('advanced');
  });

  it('P0 + 999 hours = advanced', () => {
    expect(getExperienceLevel(0, 999)).toBe('advanced');
  });

  // Expert cases
  it('ATPL (15) + 500 hours = expert (rating triggers)', () => {
    expect(getExperienceLevel(15, 500)).toBe('expert');
  });

  it('P0 + 1000 hours = expert (hours trigger)', () => {
    expect(getExperienceLevel(0, 1000)).toBe('expert');
  });

  it('ATPL + 3000 hours = expert', () => {
    expect(getExperienceLevel(15, 3000)).toBe('expert');
  });

  it('P0 + 4999 hours = expert', () => {
    expect(getExperienceLevel(0, 4999)).toBe('expert');
  });

  // Master cases
  it('FI (31) + 100 hours = master (rating triggers)', () => {
    expect(getExperienceLevel(31, 100)).toBe('master');
  });

  it('FE (63) + 50 hours = master (rating triggers)', () => {
    expect(getExperienceLevel(63, 50)).toBe('master');
  });

  it('P0 + 5000 hours = master (hours trigger)', () => {
    expect(getExperienceLevel(0, 5000)).toBe('master');
  });

  it('FE + 10000 hours = master', () => {
    expect(getExperienceLevel(63, 10000)).toBe('master');
  });

  it('P0 + 15000 hours = master', () => {
    expect(getExperienceLevel(0, 15000)).toBe('master');
  });

  // Edge case: unknown rating
  it('unknown rating (99) + 10 hours = advanced (rating >= 3)', () => {
    expect(getExperienceLevel(99, 10)).toBe('master'); // 99 >= 31
  });
});

describe('getExperienceLevelConfig', () => {
  it('should return config for beginner', () => {
    const config = getExperienceLevelConfig('beginner');
    expect(config.label).toBe('Beginner');
    expect(config.color).toBe('#22c55e');
  });

  it('should return config for master', () => {
    const config = getExperienceLevelConfig('master');
    expect(config.label).toBe('Master');
    expect(config.color).toBe('#06b6d4');
  });

  it('should return config for all 5 levels', () => {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert', 'master'] as const;
    for (const level of levels) {
      const config = getExperienceLevelConfig(level);
      expect(config.level).toBe(level);
      expect(config.label).toBeDefined();
      expect(config.color).toBeDefined();
    }
  });
});

describe('getPilotRatingInfo', () => {
  it('should return P0 for rating 0', () => {
    expect(getPilotRatingInfo(0).short).toBe('P0');
  });

  it('should return ATPL for rating 15', () => {
    const info = getPilotRatingInfo(15);
    expect(info.short).toBe('ATPL');
    expect(info.long).toBe('Airline Transport Pilot');
  });

  it('should return P0 for unknown rating', () => {
    expect(getPilotRatingInfo(999).short).toBe('P0');
  });
});

// ---- Flight Phase Detection Tests ----

describe('detectFlightPhase', () => {
  it('should detect preflight (on ground, not moving)', () => {
    expect(detectFlightPhase(0, 0, null)).toBe('preflight');
    expect(detectFlightPhase(100, 3, null)).toBe('preflight');
    expect(detectFlightPhase(400, 0, null)).toBe('preflight');
  });

  it('should detect ground (on ground, taxiing)', () => {
    expect(detectFlightPhase(0, 15, null)).toBe('ground');
    expect(detectFlightPhase(100, 25, null)).toBe('ground');
    expect(detectFlightPhase(300, 35, null)).toBe('ground');
  });

  it('should detect departing (low altitude, climbing)', () => {
    expect(detectFlightPhase(2000, 180, null, 1000)).toBe('departing');
    expect(detectFlightPhase(3000, 250, null, 2000)).toBe('departing');
  });

  it('should detect climbing (mid altitude, gaining)', () => {
    expect(detectFlightPhase(15000, 350, null, 12000)).toBe('climbing');
    expect(detectFlightPhase(25000, 400, null, 22000)).toBe('climbing');
  });

  it('should detect cruising (high altitude, stable)', () => {
    expect(detectFlightPhase(35000, 468, null, 35000)).toBe('cruising');
    expect(detectFlightPhase(38000, 480, null, 38000)).toBe('cruising');
  });

  it('should detect descending (high altitude, losing)', () => {
    expect(detectFlightPhase(25000, 400, null, 30000)).toBe('descending');
    expect(detectFlightPhase(15000, 350, null, 20000)).toBe('descending');
  });

  it('should detect arriving (low altitude, descending)', () => {
    expect(detectFlightPhase(3000, 180, null, 5000)).toBe('arriving');
    expect(detectFlightPhase(1500, 140, null, 3000)).toBe('arriving');
  });

  it('should handle no previous altitude (default to cruising at altitude)', () => {
    expect(detectFlightPhase(35000, 468, null)).toBe('cruising');
  });
});

// ---- Geographic Calculation Tests ----

describe('haversineDistance', () => {
  it('should calculate EGLL to LSZH correctly (~420nm)', () => {
    // Heathrow: 51.4775, -0.4614
    // Zurich: 47.4647, 8.5492
    const distance = haversineDistance(51.4775, -0.4614, 47.4647, 8.5492);
    expect(distance).toBeGreaterThan(400);
    expect(distance).toBeLessThan(440);
  });

  it('should calculate KJFK to EGLL correctly (~2990nm)', () => {
    // JFK: 40.6413, -73.7781
    // Heathrow: 51.4775, -0.4614
    const distance = haversineDistance(40.6413, -73.7781, 51.4775, -0.4614);
    expect(distance).toBeGreaterThan(2950);
    expect(distance).toBeLessThan(3050);
  });

  it('should return 0 for same point', () => {
    expect(haversineDistance(51.0, 10.0, 51.0, 10.0)).toBe(0);
  });

  it('should handle antipodal points (~10800nm)', () => {
    const distance = haversineDistance(0, 0, 0, 180);
    expect(distance).toBeGreaterThan(10790);
    expect(distance).toBeLessThan(10810);
  });

  it('should handle negative coordinates', () => {
    // Sydney to Auckland (~1100nm)
    const distance = haversineDistance(-33.8688, 151.2093, -36.8485, 174.7633);
    expect(distance).toBeGreaterThan(1050);
    expect(distance).toBeLessThan(1200);
  });
});

describe('calculateEta', () => {
  it('should calculate ETA correctly', () => {
    // 420nm at 468kts = ~54 minutes
    const eta = calculateEta(420, 468);
    expect(eta).toBeGreaterThan(50);
    expect(eta).toBeLessThan(60);
  });

  it('should return null for null distance', () => {
    expect(calculateEta(null, 468)).toBeNull();
  });

  it('should return null for very low speed', () => {
    expect(calculateEta(420, 10)).toBeNull();
    expect(calculateEta(420, 0)).toBeNull();
  });

  it('should handle very short distances', () => {
    const eta = calculateEta(5, 200);
    expect(eta).toBe(2); // ~1.5 rounded to 2
  });
});

describe('formatEta', () => {
  it('should format minutes only', () => {
    expect(formatEta(45)).toBe('45m');
  });

  it('should format hours and minutes', () => {
    expect(formatEta(90)).toBe('1h 30m');
  });

  it('should format multi-hour', () => {
    expect(formatEta(185)).toBe('3h 05m');
  });

  it('should return --:-- for null', () => {
    expect(formatEta(null)).toBe('--:--');
  });

  it('should handle 0 minutes', () => {
    expect(formatEta(0)).toBe('0m');
  });

  it('should handle negative (arrived)', () => {
    expect(formatEta(-5)).toBe('00:00');
  });
});

describe('formatHours', () => {
  it('should format null as N/A', () => {
    expect(formatHours(null)).toBe('N/A');
  });

  it('should format < 1 hour', () => {
    expect(formatHours(0.5)).toBe('< 1h');
  });

  it('should format single digit with decimal', () => {
    expect(formatHours(5.3)).toBe('5.3h');
  });

  it('should format large numbers with locale formatting', () => {
    const result = formatHours(2847);
    expect(result).toContain('2');
    expect(result).toContain('847');
    expect(result).toContain('h');
  });

  it('should round 10+ hours to integer', () => {
    expect(formatHours(10.7)).toBe('11h');
  });
});
