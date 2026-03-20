import { describe, it, expect } from 'vitest';
import { EXPERIENCE_LEVELS, FLIGHT_PHASE_COLORS } from './pilot';
import type { ExperienceLevel, FlightPhase } from './pilot';

describe('Experience Level Configuration', () => {
  it('should have exactly 5 experience levels', () => {
    expect(EXPERIENCE_LEVELS).toHaveLength(5);
  });

  it('should be sorted from highest to lowest (for matching order)', () => {
    const levels: ExperienceLevel[] = ['master', 'expert', 'advanced', 'intermediate', 'beginner'];
    expect(EXPERIENCE_LEVELS.map(l => l.level)).toEqual(levels);
  });

  it('should have decreasing minHours from top to bottom', () => {
    for (let i = 0; i < EXPERIENCE_LEVELS.length - 1; i++) {
      expect(EXPERIENCE_LEVELS[i].minHours).toBeGreaterThan(EXPERIENCE_LEVELS[i + 1].minHours);
    }
  });

  it('should have decreasing minRating from top to bottom', () => {
    for (let i = 0; i < EXPERIENCE_LEVELS.length - 1; i++) {
      expect(EXPERIENCE_LEVELS[i].minRating).toBeGreaterThanOrEqual(EXPERIENCE_LEVELS[i + 1].minRating);
    }
  });

  it('should have beginner as lowest with 0 hours and 0 rating', () => {
    const beginner = EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 1];
    expect(beginner.level).toBe('beginner');
    expect(beginner.minHours).toBe(0);
    expect(beginner.minRating).toBe(0);
  });

  it('should have unique colors for each level', () => {
    const colors = EXPERIENCE_LEVELS.map(l => l.color);
    expect(new Set(colors).size).toBe(5);
  });

  it('should have unique labels for each level', () => {
    const labels = EXPERIENCE_LEVELS.map(l => l.label);
    expect(new Set(labels).size).toBe(5);
  });
});

describe('Flight Phase Colors', () => {
  it('should have colors for all 8 flight phases', () => {
    const phases: FlightPhase[] = [
      'preflight', 'ground', 'departing', 'climbing',
      'cruising', 'descending', 'arriving', 'landed',
    ];
    for (const phase of phases) {
      expect(FLIGHT_PHASE_COLORS[phase]).toBeDefined();
      expect(FLIGHT_PHASE_COLORS[phase]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should have ground and landed as same color', () => {
    expect(FLIGHT_PHASE_COLORS.landed).toBe(FLIGHT_PHASE_COLORS.ground);
  });

  it('should have cruising as blue (like vatsim-radar)', () => {
    expect(FLIGHT_PHASE_COLORS.cruising).toBe('#3b82f6');
  });
});
