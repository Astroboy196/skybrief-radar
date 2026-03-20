import { describe, it, expect } from 'vitest';
import { PILOT_RATINGS, CONTROLLER_RATINGS, FACILITY_TYPES } from './vatsim';

describe('VATSIM Rating Constants', () => {
  it('should have all 7 pilot ratings', () => {
    expect(Object.keys(PILOT_RATINGS)).toHaveLength(7);
  });

  it('should have correct pilot rating IDs (bitmask pattern)', () => {
    expect(PILOT_RATINGS[0].short).toBe('P0');
    expect(PILOT_RATINGS[1].short).toBe('PPL');
    expect(PILOT_RATINGS[3].short).toBe('IR');
    expect(PILOT_RATINGS[7].short).toBe('CMEL');
    expect(PILOT_RATINGS[15].short).toBe('ATPL');
    expect(PILOT_RATINGS[31].short).toBe('FI');
    expect(PILOT_RATINGS[63].short).toBe('FE');
  });

  it('should have all 12 controller ratings', () => {
    expect(Object.keys(CONTROLLER_RATINGS)).toHaveLength(12);
  });

  it('should have correct controller rating hierarchy', () => {
    expect(CONTROLLER_RATINGS[1].short).toBe('OBS');
    expect(CONTROLLER_RATINGS[2].short).toBe('S1');
    expect(CONTROLLER_RATINGS[5].short).toBe('C1');
    expect(CONTROLLER_RATINGS[12].short).toBe('ADM');
  });

  it('should have all 7 facility types', () => {
    expect(Object.keys(FACILITY_TYPES)).toHaveLength(7);
  });

  it('should have correct facility type mapping', () => {
    expect(FACILITY_TYPES[0]).toBe('OBS');
    expect(FACILITY_TYPES[4]).toBe('TWR');
    expect(FACILITY_TYPES[6]).toBe('CTR');
  });
});
