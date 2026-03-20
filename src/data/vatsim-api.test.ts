import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parsePilot,
  parseFlightPlan,
  parseController,
  parseAtis,
  extractStreamUrls,
  onDataUpdate,
  getState,
  getPilotByCallsign,
  getControllersForAirport,
  getActiveFrequency,
  _resetState,
} from './vatsim-api';

// ---- Mock Data ----

const MOCK_PILOT_RAW = {
  cid: 1234567,
  name: 'John Doe',
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
    aircraft: 'B738/M-SDE3FGHIRWXY/LB1',
    aircraft_faa: 'B738/L',
    aircraft_short: 'B738',
    departure: 'EGLL',
    arrival: 'LSZH',
    alternate: 'LSGG',
    deptime: '1400',
    enroute_time: '0130',
    fuel_time: '0400',
    remarks: 'PBN/A1B1C1D1S2 DOF/260320 REG/GEUYA OPR/BAW ORGN/EGLLZPZX /v/ twitch.tv/johndoe123',
    route: 'DVR UL9 KONAN UL607 KOK HELEN NELLO RESIA',
    revision_id: 1,
    assigned_transponder: '4521',
  },
  logon_time: '2026-03-20T14:00:00Z',
  last_updated: '2026-03-20T15:30:00Z',
};

const MOCK_CONTROLLER_RAW = {
  cid: 9876543,
  name: 'Jane Smith',
  callsign: 'LSZH_TWR',
  frequency: '118.100',
  facility: 4,
  rating: 5,
  server: 'UK-1',
  visual_range: 50,
  text_atis: ['LSZH ATIS Information Alpha', 'RWY 14 in use', 'QNH 1013'],
  logon_time: '2026-03-20T13:00:00Z',
  last_updated: '2026-03-20T15:30:00Z',
};

// ---- Pilot Parsing Tests ----

describe('parsePilot', () => {
  beforeEach(() => _resetState());

  it('should parse a valid pilot correctly', () => {
    const pilot = parsePilot(MOCK_PILOT_RAW);
    expect(pilot).not.toBeNull();
    expect(pilot!.cid).toBe(1234567);
    expect(pilot!.callsign).toBe('BAW123');
    expect(pilot!.latitude).toBe(51.4775);
    expect(pilot!.longitude).toBe(-0.4614);
    expect(pilot!.altitude).toBe(35000);
    expect(pilot!.groundspeed).toBe(468);
    expect(pilot!.heading).toBe(135);
    expect(pilot!.pilot_rating).toBe(15);
  });

  it('should return null for missing cid', () => {
    const raw = { ...MOCK_PILOT_RAW, cid: undefined };
    expect(parsePilot(raw as any)).toBeNull();
  });

  it('should return null for missing callsign', () => {
    const raw = { ...MOCK_PILOT_RAW, callsign: undefined };
    expect(parsePilot(raw as any)).toBeNull();
  });

  it('should return null for missing coordinates', () => {
    expect(parsePilot({ ...MOCK_PILOT_RAW, latitude: undefined } as any)).toBeNull();
    expect(parsePilot({ ...MOCK_PILOT_RAW, longitude: undefined } as any)).toBeNull();
  });

  it('should handle missing optional fields with defaults', () => {
    const minimal = {
      cid: 1,
      callsign: 'TEST1',
      latitude: 0,
      longitude: 0,
    };
    const pilot = parsePilot(minimal as any);
    expect(pilot).not.toBeNull();
    expect(pilot!.name).toBe('');
    expect(pilot!.altitude).toBe(0);
    expect(pilot!.groundspeed).toBe(0);
    expect(pilot!.transponder).toBe('0000');
    expect(pilot!.pilot_rating).toBe(0);
    expect(pilot!.flight_plan).toBeNull();
  });

  it('should parse pilot with null flight plan', () => {
    const raw = { ...MOCK_PILOT_RAW, flight_plan: null };
    const pilot = parsePilot(raw as any);
    expect(pilot!.flight_plan).toBeNull();
  });
});

// ---- Flight Plan Parsing Tests ----

describe('parseFlightPlan', () => {
  it('should parse a complete flight plan', () => {
    const fp = parseFlightPlan(MOCK_PILOT_RAW.flight_plan);
    expect(fp).not.toBeNull();
    expect(fp!.flight_rules).toBe('I');
    expect(fp!.aircraft_short).toBe('B738');
    expect(fp!.departure).toBe('EGLL');
    expect(fp!.arrival).toBe('LSZH');
    expect(fp!.alternate).toBe('LSGG');
    expect(fp!.route).toContain('DVR');
    expect(fp!.remarks).toContain('twitch.tv');
  });

  it('should return null for null input', () => {
    expect(parseFlightPlan(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(parseFlightPlan(undefined)).toBeNull();
  });

  it('should return null for non-object input', () => {
    expect(parseFlightPlan('string')).toBeNull();
    expect(parseFlightPlan(123)).toBeNull();
  });

  it('should handle VFR flight rules', () => {
    const fp = parseFlightPlan({ ...MOCK_PILOT_RAW.flight_plan, flight_rules: 'V' });
    expect(fp!.flight_rules).toBe('V');
  });

  it('should default to IFR for invalid flight rules', () => {
    const fp = parseFlightPlan({ ...MOCK_PILOT_RAW.flight_plan, flight_rules: 'X' });
    expect(fp!.flight_rules).toBe('I');
  });

  it('should handle empty/missing fields with defaults', () => {
    const fp = parseFlightPlan({});
    expect(fp).not.toBeNull();
    expect(fp!.departure).toBe('');
    expect(fp!.arrival).toBe('');
    expect(fp!.route).toBe('');
    expect(fp!.remarks).toBe('');
    expect(fp!.aircraft_short).toBe('');
  });
});

// ---- Controller Parsing Tests ----

describe('parseController', () => {
  it('should parse a valid controller', () => {
    const ctrl = parseController(MOCK_CONTROLLER_RAW);
    expect(ctrl).not.toBeNull();
    expect(ctrl!.cid).toBe(9876543);
    expect(ctrl!.callsign).toBe('LSZH_TWR');
    expect(ctrl!.frequency).toBe('118.100');
    expect(ctrl!.facility).toBe(4);
    expect(ctrl!.rating).toBe(5);
    expect(ctrl!.text_atis).toHaveLength(3);
  });

  it('should return null for missing cid', () => {
    expect(parseController({ ...MOCK_CONTROLLER_RAW, cid: undefined } as any)).toBeNull();
  });

  it('should return null for missing callsign', () => {
    expect(parseController({ ...MOCK_CONTROLLER_RAW, callsign: undefined } as any)).toBeNull();
  });

  it('should handle null text_atis', () => {
    const ctrl = parseController({ ...MOCK_CONTROLLER_RAW, text_atis: null } as any);
    expect(ctrl!.text_atis).toBeNull();
  });

  it('should handle non-array text_atis', () => {
    const ctrl = parseController({ ...MOCK_CONTROLLER_RAW, text_atis: 'not an array' } as any);
    expect(ctrl!.text_atis).toBeNull();
  });
});

// ---- ATIS Parsing Tests ----

describe('parseAtis', () => {
  it('should parse ATIS with atis_code', () => {
    const raw = { ...MOCK_CONTROLLER_RAW, callsign: 'LSZH_ATIS', atis_code: 'A' };
    const atis = parseAtis(raw);
    expect(atis).not.toBeNull();
    expect(atis!.atis_code).toBe('A');
    expect(atis!.callsign).toBe('LSZH_ATIS');
  });

  it('should handle missing atis_code', () => {
    const atis = parseAtis(MOCK_CONTROLLER_RAW);
    expect(atis!.atis_code).toBe('');
  });
});

// ---- Stream URL Extraction Tests ----

describe('extractStreamUrls', () => {
  it('should extract Twitch URL from remarks', () => {
    const result = extractStreamUrls('PBN/A1B1 /v/ twitch.tv/johndoe123');
    expect(result.twitch).toBe('johndoe123');
  });

  it('should extract Twitch URL with https prefix', () => {
    const result = extractStreamUrls('OPR/BAW https://www.twitch.tv/PilotStream');
    expect(result.twitch).toBe('pilotstream');
  });

  it('should extract Twitch URL with http prefix', () => {
    const result = extractStreamUrls('http://twitch.tv/MyChannel');
    expect(result.twitch).toBe('mychannel');
  });

  it('should extract YouTube channel URL', () => {
    const result = extractStreamUrls('Check out youtube.com/c/AviationChannel');
    expect(result.youtube).toBe('AviationChannel');
  });

  it('should extract YouTube handle URL', () => {
    const result = extractStreamUrls('Follow me at youtube.com/@PilotJoe');
    expect(result.youtube).toBe('PilotJoe');
  });

  it('should extract both Twitch and YouTube', () => {
    const result = extractStreamUrls('twitch.tv/streamer1 youtube.com/@channel1');
    expect(result.twitch).toBe('streamer1');
    expect(result.youtube).toBe('channel1');
  });

  it('should return empty for remarks without stream URLs', () => {
    const result = extractStreamUrls('PBN/A1B1C1D1S2 DOF/260320 REG/GEUYA OPR/BAW');
    expect(result.twitch).toBeUndefined();
    expect(result.youtube).toBeUndefined();
  });

  it('should return empty for empty string', () => {
    const result = extractStreamUrls('');
    expect(result.twitch).toBeUndefined();
    expect(result.youtube).toBeUndefined();
  });

  it('should handle Twitch URL with underscores in username', () => {
    const result = extractStreamUrls('twitch.tv/pilot_name_123');
    expect(result.twitch).toBe('pilot_name_123');
  });
});

// ---- State & Lookup Tests ----

describe('State Management', () => {
  beforeEach(() => _resetState());

  it('should start with empty state', () => {
    const s = getState();
    expect(s.pilots).toHaveLength(0);
    expect(s.controllers).toHaveLength(0);
    expect(s.initialized).toBe(false);
    expect(s.lastError).toBeNull();
  });

  it('should return undefined for non-existent pilot callsign', () => {
    expect(getPilotByCallsign('NONEXIST')).toBeUndefined();
  });

  it('should return empty array for airport with no controllers', () => {
    expect(getControllersForAirport('ZZZZ')).toHaveLength(0);
  });

  it('should return null frequency for unknown callsign', () => {
    expect(getActiveFrequency('UNKNOWN')).toBeNull();
  });
});

// ---- Listener Tests ----

describe('Event System', () => {
  beforeEach(() => _resetState());

  it('should register and unregister listeners', () => {
    const callback = vi.fn();
    const unsub = onDataUpdate(callback);

    // Should not be called since not initialized
    expect(callback).not.toHaveBeenCalled();

    unsub();
  });
});
