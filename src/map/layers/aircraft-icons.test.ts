import { describe, it, expect } from 'vitest';
import {
  getAircraftIconId,
  PHASE_COLORS,
  STREAMING_COLOR,
  BADGE_COLORS,
  AIRCRAFT_SVGS,
} from './aircraft-icons';
import type { AircraftCategory, FlightPhase, ExperienceLevel } from '@/types';

describe('Aircraft SVGs', () => {
  it('should have SVG for all 13 categories', () => {
    const categories: AircraftCategory[] = [
      'single-prop', 'twin-prop', 'business-jet', 'regional-jet',
      'narrow-body', 'wide-body', 'jumbo', 'cargo',
      'helicopter', 'military-fighter', 'military-transport',
      'general-aviation', 'unknown',
    ];
    expect(Object.keys(AIRCRAFT_SVGS)).toHaveLength(13);
    for (const cat of categories) {
      expect(AIRCRAFT_SVGS[cat]).toBeDefined();
      expect(AIRCRAFT_SVGS[cat]).toContain('<svg');
      expect(AIRCRAFT_SVGS[cat]).toContain('FILL_COLOR');
    }
  });

  it('should have valid SVG structure', () => {
    for (const [, svg] of Object.entries(AIRCRAFT_SVGS)) {
      expect(svg).toContain('viewBox="0 0 64 64"');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });
});

describe('Phase Colors', () => {
  it('should have colors for all 8 flight phases', () => {
    const phases: FlightPhase[] = [
      'preflight', 'ground', 'departing', 'climbing',
      'cruising', 'descending', 'arriving', 'landed',
    ];
    for (const phase of phases) {
      expect(PHASE_COLORS[phase]).toBeDefined();
      expect(PHASE_COLORS[phase]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should have cruising as blue', () => {
    expect(PHASE_COLORS.cruising).toBe('#3b82f6');
  });

  it('should have streaming color as red', () => {
    expect(STREAMING_COLOR).toBe('#ef4444');
  });
});

describe('Badge Colors', () => {
  it('should have colors for all 5 experience levels', () => {
    const levels: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
    for (const level of levels) {
      expect(BADGE_COLORS[level]).toBeDefined();
      expect(BADGE_COLORS[level]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('should have unique colors', () => {
    const colors = Object.values(BADGE_COLORS);
    expect(new Set(colors).size).toBe(5);
  });
});

describe('getAircraftIconId', () => {
  it('should return phase-based icon ID', () => {
    expect(getAircraftIconId('narrow-body', 'cruising', false))
      .toBe('aircraft-narrow-body-cruising');
  });

  it('should return streaming icon ID when streaming', () => {
    expect(getAircraftIconId('narrow-body', 'cruising', true))
      .toBe('aircraft-narrow-body-streaming');
  });

  it('should work for all categories', () => {
    expect(getAircraftIconId('helicopter', 'ground', false))
      .toBe('aircraft-helicopter-ground');
    expect(getAircraftIconId('jumbo', 'departing', false))
      .toBe('aircraft-jumbo-departing');
    expect(getAircraftIconId('military-fighter', 'climbing', false))
      .toBe('aircraft-military-fighter-climbing');
  });

  it('should always prefer streaming when flag is true', () => {
    const categories: AircraftCategory[] = ['narrow-body', 'wide-body', 'helicopter'];
    const phases: FlightPhase[] = ['cruising', 'ground', 'departing'];

    for (const cat of categories) {
      for (const phase of phases) {
        const id = getAircraftIconId(cat, phase, true);
        expect(id).toContain('streaming');
        expect(id).not.toContain(phase);
      }
    }
  });
});
