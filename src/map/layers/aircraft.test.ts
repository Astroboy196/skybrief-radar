import { describe, it, expect } from 'vitest';

// Test the exported math helpers (lerp, lerpAngle) directly
// MapLibre-dependent functions tested via manual testing on the map

// Import via the module to get the helpers
import { lerp, lerpAngle } from './aircraft';

describe('lerp (linear interpolation)', () => {
  it('should return start at t=0', () => {
    expect(lerp(0, 100, 0)).toBe(0);
  });

  it('should return end at t=1', () => {
    expect(lerp(0, 100, 1)).toBe(100);
  });

  it('should return midpoint at t=0.5', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  it('should handle negative values', () => {
    expect(lerp(-50, 50, 0.5)).toBe(0);
  });

  it('should handle same start and end', () => {
    expect(lerp(42, 42, 0.7)).toBe(42);
  });

  it('should handle quarter progress', () => {
    expect(lerp(0, 100, 0.25)).toBe(25);
  });
});

describe('lerpAngle (angular interpolation, shortest arc)', () => {
  it('should interpolate simple angle', () => {
    expect(lerpAngle(0, 90, 0.5)).toBe(45);
  });

  it('should return start at t=0', () => {
    expect(lerpAngle(45, 135, 0)).toBe(45);
  });

  it('should return end at t=1', () => {
    expect(lerpAngle(45, 135, 1)).toBe(135);
  });

  it('should take shortest arc across 360/0 boundary', () => {
    // From 350 to 10 should go through 0, not all way around
    const result = lerpAngle(350, 10, 0.5);
    expect(result).toBe(0);
  });

  it('should handle 0 to 360 (same angle)', () => {
    const result = lerpAngle(0, 360, 0.5);
    // 360 == 0, so should stay at 0
    expect(result).toBeCloseTo(0, 1);
  });

  it('should handle reverse direction across boundary', () => {
    // From 10 to 350 should go backwards through 0
    const result = lerpAngle(10, 350, 0.5);
    expect(result).toBe(0);
  });

  it('should handle 180 degree turn', () => {
    const result = lerpAngle(0, 180, 0.5);
    // 180 is ambiguous (could go either way), just check it's valid
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });

  it('should always return 0-360 range', () => {
    for (let a = 0; a < 360; a += 30) {
      for (let b = 0; b < 360; b += 30) {
        const result = lerpAngle(a, b, 0.5);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThan(360);
      }
    }
  });
});
