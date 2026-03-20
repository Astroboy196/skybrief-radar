import { describe, it, expect } from 'vitest';
import { FLIGHT_RULES_COLORS, SIGMET_COLORS } from './weather';
import type { FlightRules, SigmetHazard } from './weather';

describe('Flight Rules Colors', () => {
  it('should have colors for all 4 flight rules categories', () => {
    const rules: FlightRules[] = ['VFR', 'MVFR', 'IFR', 'LIFR'];
    for (const rule of rules) {
      expect(FLIGHT_RULES_COLORS[rule]).toBeDefined();
      expect(FLIGHT_RULES_COLORS[rule]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should have VFR as green', () => {
    expect(FLIGHT_RULES_COLORS.VFR).toBe('#22c55e');
  });

  it('should have IFR as red', () => {
    expect(FLIGHT_RULES_COLORS.IFR).toBe('#ef4444');
  });

  it('should have all 4 colors unique', () => {
    const colors = Object.values(FLIGHT_RULES_COLORS);
    expect(new Set(colors).size).toBe(4);
  });
});

describe('SIGMET Hazard Colors', () => {
  it('should have colors for all 9 hazard types', () => {
    const hazards: SigmetHazard[] = [
      'TURB', 'ICE', 'IFR', 'MTN_OBSCN', 'TS', 'VA', 'TC', 'SS', 'OTHER',
    ];
    for (const hazard of hazards) {
      expect(SIGMET_COLORS[hazard]).toBeDefined();
      expect(SIGMET_COLORS[hazard]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should have turbulence as orange', () => {
    expect(SIGMET_COLORS.TURB).toBe('#f97316');
  });

  it('should have icing as cyan', () => {
    expect(SIGMET_COLORS.ICE).toBe('#06b6d4');
  });

  it('should have thunderstorms as yellow', () => {
    expect(SIGMET_COLORS.TS).toBe('#eab308');
  });
});
