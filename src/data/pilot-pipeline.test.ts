import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAircraftCategory,
  enrichPilot,
  buildGeoJson,
  cleanupOfflinePilots,
  _resetPipeline,
} from './pilot-pipeline';
import type { VatsimPilot } from '@/types';
import { _resetState } from './vatsim-api';
import { _clearCache } from './vatsim-stats';

// ---- Mock Data ----

function createMockPilot(overrides: Partial<VatsimPilot> = {}): VatsimPilot {
  return {
    cid: 1234567,
    name: 'Test Pilot',
    callsign: 'BAW123',
    server: 'UK-1',
    pilot_rating: 15,
    military_rating: 0,
    latitude: 51.4775,
    longitude: -0.4614,
    altitude: 35000,
    groundspeed: 468,
    transponder: '4521',
    heading: 135,
    qnh_i_hg: 29.92,
    qnh_mb: 1013,
    flight_plan: {
      flight_rules: 'I',
      aircraft: 'B738/M',
      aircraft_faa: 'B738/L',
      aircraft_short: 'B738',
      departure: 'EGLL',
      arrival: 'LSZH',
      alternate: 'LSGG',
      deptime: '1400',
      enroute_time: '0130',
      fuel_time: '0400',
      remarks: 'PBN/A1B1 OPR/BAW',
      route: 'DVR UL9 KONAN',
      revision_id: 1,
      assigned_transponder: '4521',
    },
    logon_time: '2026-03-20T14:00:00Z',
    last_updated: '2026-03-20T15:30:00Z',
    ...overrides,
  };
}

// ---- Setup ----

beforeEach(() => {
  _resetPipeline();
  _resetState();
  _clearCache();
});

// ---- Aircraft Category Tests ----

describe('getAircraftCategory', () => {
  // Single prop
  it('C172 → single-prop', () => expect(getAircraftCategory('C172')).toBe('single-prop'));
  it('PA28 → single-prop', () => expect(getAircraftCategory('PA28')).toBe('single-prop'));
  it('SR22 → single-prop', () => expect(getAircraftCategory('SR22')).toBe('single-prop'));

  // Twin prop / turboprop
  it('DH8D → twin-prop', () => expect(getAircraftCategory('DH8D')).toBe('twin-prop'));
  it('AT72 → twin-prop', () => expect(getAircraftCategory('AT72')).toBe('twin-prop'));
  it('DA42 → twin-prop', () => expect(getAircraftCategory('DA42')).toBe('twin-prop'));

  // Business jet
  it('C525 → business-jet', () => expect(getAircraftCategory('C525')).toBe('business-jet'));
  it('GLEX → business-jet', () => expect(getAircraftCategory('GLEX')).toBe('business-jet'));

  // Regional jet
  it('E190 → regional-jet', () => expect(getAircraftCategory('E190')).toBe('regional-jet'));
  it('CRJ9 → regional-jet', () => expect(getAircraftCategory('CRJ9')).toBe('regional-jet'));

  // Narrow body
  it('B738 → narrow-body', () => expect(getAircraftCategory('B738')).toBe('narrow-body'));
  it('A320 → narrow-body', () => expect(getAircraftCategory('A320')).toBe('narrow-body'));
  it('A21N → narrow-body', () => expect(getAircraftCategory('A21N')).toBe('narrow-body'));
  it('B37M → narrow-body', () => expect(getAircraftCategory('B37M')).toBe('narrow-body'));

  // Wide body
  it('B789 → wide-body', () => expect(getAircraftCategory('B789')).toBe('wide-body'));
  it('A359 → wide-body', () => expect(getAircraftCategory('A359')).toBe('wide-body'));
  it('B77W → wide-body', () => expect(getAircraftCategory('B77W')).toBe('wide-body'));

  // Jumbo
  it('A388 → jumbo', () => expect(getAircraftCategory('A388')).toBe('jumbo'));
  it('B748 → jumbo', () => expect(getAircraftCategory('B748')).toBe('jumbo'));

  // Cargo
  it('B77F → cargo', () => expect(getAircraftCategory('B77F')).toBe('cargo'));
  it('B74F → cargo', () => expect(getAircraftCategory('B74F')).toBe('cargo'));

  // Helicopter
  it('H135 → helicopter', () => expect(getAircraftCategory('H135')).toBe('helicopter'));
  it('R44 → helicopter', () => expect(getAircraftCategory('R44')).toBe('helicopter'));

  // Military
  it('F16 → military-fighter', () => expect(getAircraftCategory('F16')).toBe('military-fighter'));
  it('C130 → military-transport', () => expect(getAircraftCategory('C130')).toBe('military-transport'));

  // Edge cases
  it('empty string → unknown', () => expect(getAircraftCategory('')).toBe('unknown'));
  it('lowercase b738 → narrow-body', () => expect(getAircraftCategory('b738')).toBe('narrow-body'));
  it('unknown type → unknown', () => expect(getAircraftCategory('XXXX')).toBe('unknown'));
});

// ---- Enrich Pilot Tests ----

describe('enrichPilot', () => {
  it('should enrich a basic pilot correctly', () => {
    const raw = createMockPilot();
    const enriched = enrichPilot(raw);

    expect(enriched.cid).toBe(1234567);
    expect(enriched.callsign).toBe('BAW123');
    expect(enriched.latitude).toBe(51.4775);
    expect(enriched.longitude).toBe(-0.4614);
    expect(enriched.altitude).toBe(35000);
    expect(enriched.groundspeed).toBe(468);
    expect(enriched.heading).toBe(135);
  });

  it('should compute pilot rating info', () => {
    const enriched = enrichPilot(createMockPilot({ pilot_rating: 15 }));
    expect(enriched.pilotRatingShort).toBe('ATPL');
    expect(enriched.pilotRatingLong).toBe('Airline Transport Pilot');
  });

  it('should compute experience level without stats', () => {
    // ATPL (15) with no hours → expert (rating alone triggers)
    const enriched = enrichPilot(createMockPilot({ pilot_rating: 15 }));
    expect(enriched.experienceLevel).toBe('expert');
  });

  it('should compute beginner for P0 with no stats', () => {
    const enriched = enrichPilot(createMockPilot({ pilot_rating: 0 }));
    expect(enriched.experienceLevel).toBe('beginner');
  });

  it('should detect flight phase as cruising at FL350 + 468kts', () => {
    // First call — no previous altitude, defaults to cruising
    const enriched = enrichPilot(createMockPilot());
    expect(enriched.flightPhase).toBe('cruising');
  });

  it('should detect preflight on ground with no speed', () => {
    const enriched = enrichPilot(createMockPilot({
      altitude: 0,
      groundspeed: 0,
    }));
    expect(enriched.flightPhase).toBe('preflight');
  });

  it('should track previous position', () => {
    const pilot = createMockPilot();

    // First call
    const first = enrichPilot(pilot);
    expect(first.prevLatitude).toBe(pilot.latitude); // Same as current (no prev)

    // Second call with moved position
    const moved = createMockPilot({
      latitude: 52.0,
      longitude: 0.0,
    });
    const second = enrichPilot(moved);
    expect(second.prevLatitude).toBe(51.4775); // Previous position
    expect(second.prevLongitude).toBe(-0.4614);
  });

  it('should include social profile when provided', () => {
    const profiles = new Map([[1234567, {
      cid: 1234567,
      twitch: 'testpilot',
      youtube: 'testchannel',
      updatedAt: Date.now(),
    }]]);

    const enriched = enrichPilot(createMockPilot(), { socialProfiles: profiles });
    expect(enriched.socialProfile).not.toBeNull();
    expect(enriched.socialProfile!.twitch).toBe('testpilot');
  });

  it('should include streaming status when provided', () => {
    const statuses = new Map([[1234567, {
      isLive: true,
      platform: 'twitch' as const,
      username: 'testpilot',
      streamUrl: 'https://twitch.tv/testpilot',
      viewerCount: 42,
      title: 'Flying EGLL-LSZH',
      thumbnailUrl: '',
    }]]);

    const enriched = enrichPilot(createMockPilot(), { streamingStatuses: statuses });
    expect(enriched.streaming.isLive).toBe(true);
    expect(enriched.streaming.platform).toBe('twitch');
    expect(enriched.streaming.viewerCount).toBe(42);
  });

  it('should default to not streaming', () => {
    const enriched = enrichPilot(createMockPilot());
    expect(enriched.streaming.isLive).toBe(false);
    expect(enriched.streaming.platform).toBe('none');
  });

  it('should handle pilot with no flight plan', () => {
    const enriched = enrichPilot(createMockPilot({ flight_plan: null }));
    expect(enriched.flightPlan).toBeNull();
    expect(enriched.distanceToDestination).toBeNull();
    expect(enriched.etaMinutes).toBeNull();
  });
});

// ---- GeoJSON Builder Tests ----

describe('buildGeoJson', () => {
  it('should build valid GeoJSON FeatureCollection', () => {
    const pilots = [enrichPilot(createMockPilot())];
    const geojson = buildGeoJson(pilots);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
  });

  it('should set correct coordinates [lng, lat]', () => {
    const pilots = [enrichPilot(createMockPilot())];
    const geojson = buildGeoJson(pilots);
    const feature = geojson.features[0];

    expect(feature.geometry.type).toBe('Point');
    expect(feature.geometry.coordinates[0]).toBe(-0.4614); // longitude first
    expect(feature.geometry.coordinates[1]).toBe(51.4775); // latitude second
  });

  it('should include all required properties', () => {
    const pilots = [enrichPilot(createMockPilot())];
    const geojson = buildGeoJson(pilots);
    const props = geojson.features[0].properties;

    expect(props.cid).toBe(1234567);
    expect(props.callsign).toBe('BAW123');
    expect(props.heading).toBe(135);
    expect(props.altitude).toBe(35000);
    expect(props.groundspeed).toBe(468);
    expect(props.aircraftType).toBe('B738');
    expect(props.aircraftCategory).toBe('narrow-body');
    expect(props.flightPhase).toBe('cruising');
    expect(props.experienceLevel).toBe('expert');
    expect(props.isStreaming).toBe(false);
    expect(props.departure).toBe('EGLL');
    expect(props.arrival).toBe('LSZH');
  });

  it('should handle empty pilot list', () => {
    const geojson = buildGeoJson([]);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(0);
  });

  it('should handle multiple pilots', () => {
    const pilots = [
      enrichPilot(createMockPilot({ cid: 1, callsign: 'AAL1' })),
      enrichPilot(createMockPilot({ cid: 2, callsign: 'DLH2' })),
      enrichPilot(createMockPilot({ cid: 3, callsign: 'SWR3' })),
    ];
    const geojson = buildGeoJson(pilots);
    expect(geojson.features).toHaveLength(3);
    expect(geojson.features.map(f => f.properties.callsign)).toEqual(['AAL1', 'DLH2', 'SWR3']);
  });

  it('should handle pilot without flight plan', () => {
    const pilots = [enrichPilot(createMockPilot({ flight_plan: null }))];
    const geojson = buildGeoJson(pilots);
    const props = geojson.features[0].properties;

    expect(props.aircraftType).toBe('');
    expect(props.aircraftCategory).toBe('unknown');
    expect(props.departure).toBe('');
    expect(props.arrival).toBe('');
  });
});

// ---- Cleanup Tests ----

describe('cleanupOfflinePilots', () => {
  it('should remove positions for offline pilots', () => {
    // Enrich two pilots to create position entries
    enrichPilot(createMockPilot({ cid: 1 }));
    enrichPilot(createMockPilot({ cid: 2 }));
    enrichPilot(createMockPilot({ cid: 3 }));

    // Only CID 1 is still online
    const cleaned = cleanupOfflinePilots(new Set([1]));
    expect(cleaned).toBe(2);
  });

  it('should keep all positions when all pilots online', () => {
    enrichPilot(createMockPilot({ cid: 1 }));
    enrichPilot(createMockPilot({ cid: 2 }));

    const cleaned = cleanupOfflinePilots(new Set([1, 2]));
    expect(cleaned).toBe(0);
  });

  it('should handle empty online set', () => {
    enrichPilot(createMockPilot({ cid: 1 }));
    const cleaned = cleanupOfflinePilots(new Set());
    expect(cleaned).toBe(1);
  });
});
