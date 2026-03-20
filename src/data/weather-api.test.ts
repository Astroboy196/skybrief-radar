import { describe, it, expect, beforeEach } from 'vitest';
import {
  decodeMetar,
  calculateFlightRules,
  categorizeHazard,
  parseSigmets,
  buildRainViewerTileUrl,
  getRadarFrames,
  clearWeatherCache,
} from './weather-api';
import type { RainViewerData, RainViewerFrame } from '@/types';

beforeEach(() => {
  clearWeatherCache();
});

// ---- METAR Decoding Tests ----

describe('decodeMetar', () => {
  it('should decode a standard European METAR', () => {
    const raw = 'LSZH 201550Z 24012G22KT 9999 FEW040 BKN080 18/09 Q1013';
    const decoded = decodeMetar('LSZH', raw);

    expect(decoded.icao).toBe('LSZH');
    expect(decoded.raw).toBe(raw);
    expect(decoded.observationTime).toBe('201550Z');
    expect(decoded.wind.direction).toBe(240);
    expect(decoded.wind.speed).toBe(12);
    expect(decoded.wind.gust).toBe(22);
    expect(decoded.wind.variable).toBe(false);
    expect(decoded.temperature).toBe(18);
    expect(decoded.dewpoint).toBe(9);
    expect(decoded.altimeter.hpa).toBe(1013);
  });

  it('should decode US-style METAR with altimeter', () => {
    const raw = 'KJFK 201556Z 18015KT 10SM SCT250 22/14 A2992';
    const decoded = decodeMetar('KJFK', raw);

    expect(decoded.wind.direction).toBe(180);
    expect(decoded.wind.speed).toBe(15);
    expect(decoded.wind.gust).toBeNull();
    expect(decoded.altimeter.inhg).toBeCloseTo(29.92, 1);
  });

  it('should handle variable wind', () => {
    const raw = 'EGLL 201550Z VRB03KT 9999 FEW040 15/10 Q1020';
    const decoded = decodeMetar('EGLL', raw);

    expect(decoded.wind.variable).toBe(true);
    expect(decoded.wind.direction).toBeNull();
    expect(decoded.wind.speed).toBe(3);
  });

  it('should handle negative temperatures (M prefix)', () => {
    const raw = 'BIKF 201550Z 36010KT 9999 SCT020 M02/M05 Q1008';
    const decoded = decodeMetar('BIKF', raw);

    expect(decoded.temperature).toBe(-2);
    expect(decoded.dewpoint).toBe(-5);
  });

  it('should extract cloud layers', () => {
    const raw = 'LSZH 201550Z 24008KT 9999 FEW020 SCT040 BKN080 OVC120 15/10 Q1013';
    const decoded = decodeMetar('LSZH', raw);

    expect(decoded.clouds).toHaveLength(4);
    expect(decoded.clouds[0]).toEqual({ coverage: 'FEW', altitude: 2000, type: undefined });
    expect(decoded.clouds[1]).toEqual({ coverage: 'SCT', altitude: 4000, type: undefined });
    expect(decoded.clouds[2]).toEqual({ coverage: 'BKN', altitude: 8000, type: undefined });
    expect(decoded.clouds[3]).toEqual({ coverage: 'OVC', altitude: 12000, type: undefined });
  });

  it('should detect CB clouds', () => {
    const raw = 'VHHH 201550Z 18010KT 5000 SCT020CB BKN040 28/24 Q1008';
    const decoded = decodeMetar('VHHH', raw);

    const cbLayer = decoded.clouds.find(c => c.type === 'CB');
    expect(cbLayer).toBeDefined();
    expect(cbLayer!.coverage).toBe('SCT');
    expect(cbLayer!.altitude).toBe(2000);
  });

  it('should extract ceiling from BKN/OVC', () => {
    const raw = 'EGLL 201550Z 27010KT 9999 SCT015 BKN025 12/08 Q1015';
    const decoded = decodeMetar('EGLL', raw);
    expect(decoded.ceiling).toBe(2500);
  });

  it('should return null ceiling for clear skies', () => {
    const raw = 'KLAX 201550Z 25010KT 10SM CLR 22/12 A2992';
    const decoded = decodeMetar('KLAX', raw);
    expect(decoded.ceiling).toBeNull();
  });

  it('should handle CAVOK', () => {
    const raw = 'LFPG 201550Z 20008KT CAVOK 20/12 Q1018';
    const decoded = decodeMetar('LFPG', raw);
    expect(decoded.visibility.meters).toBe(16093); // 10SM default
  });

  it('should handle meter visibility', () => {
    const raw = 'EGLL 201550Z 27010KT 3000 BR BKN004 08/07 Q1015';
    const decoded = decodeMetar('EGLL', raw);
    expect(decoded.visibility.meters).toBe(3000);
  });

  it('should extract QNH in hPa', () => {
    const raw = 'LSZH 201550Z 24008KT 9999 FEW040 18/09 Q1023';
    const decoded = decodeMetar('LSZH', raw);
    expect(decoded.altimeter.hpa).toBe(1023);
  });
});

// ---- Flight Rules Tests ----

describe('calculateFlightRules', () => {
  it('VFR: ceiling >= 3000 AND vis >= 5', () => {
    expect(calculateFlightRules(10, 5000)).toBe('VFR');
    expect(calculateFlightRules(5, 3000)).toBe('VFR');
    expect(calculateFlightRules(10, null)).toBe('VFR');
  });

  it('MVFR: ceiling 1000-2999 OR vis 3-4.99', () => {
    expect(calculateFlightRules(10, 2000)).toBe('MVFR');
    expect(calculateFlightRules(4, 5000)).toBe('MVFR');
    expect(calculateFlightRules(3, 1500)).toBe('MVFR');
  });

  it('IFR: ceiling 500-999 OR vis 1-2.99', () => {
    expect(calculateFlightRules(10, 800)).toBe('IFR');
    expect(calculateFlightRules(2, 5000)).toBe('IFR');
    expect(calculateFlightRules(1.5, 700)).toBe('IFR');
  });

  it('LIFR: ceiling < 500 OR vis < 1', () => {
    expect(calculateFlightRules(10, 300)).toBe('LIFR');
    expect(calculateFlightRules(0.5, 5000)).toBe('LIFR');
    expect(calculateFlightRules(0.25, 200)).toBe('LIFR');
  });

  it('should treat null ceiling as unlimited', () => {
    expect(calculateFlightRules(10, null)).toBe('VFR');
    expect(calculateFlightRules(2, null)).toBe('IFR');
    expect(calculateFlightRules(0.5, null)).toBe('LIFR');
  });
});

// ---- SIGMET Parsing Tests ----

describe('categorizeHazard', () => {
  it('should detect turbulence', () => {
    expect(categorizeHazard('SIGMET TURB SEV FL250-FL400')).toBe('TURB');
  });

  it('should detect icing', () => {
    expect(categorizeHazard('MOD ICING FZLVL 080')).toBe('ICE');
  });

  it('should detect thunderstorms', () => {
    expect(categorizeHazard('EMBD TS MOV NE')).toBe('TS');
    expect(categorizeHazard('CONVECTIVE SIGMET')).toBe('TS');
  });

  it('should detect IFR conditions', () => {
    expect(categorizeHazard('IFR CIG BLW 010')).toBe('IFR');
  });

  it('should detect mountain obscuration', () => {
    expect(categorizeHazard('MTN OBSCN CIG BLW')).toBe('MTN_OBSCN');
  });

  it('should detect volcanic ash', () => {
    expect(categorizeHazard('VA CLD OBS')).toBe('VA');
  });

  it('should detect tropical cyclone', () => {
    expect(categorizeHazard('TC KATRINA')).toBe('TC');
  });

  it('should default to OTHER', () => {
    expect(categorizeHazard('UNKNOWN HAZARD')).toBe('OTHER');
  });
});

describe('parseSigmets', () => {
  it('should parse SIGMET array', () => {
    const raw = [
      {
        airSigmetId: 'SIG001',
        airSigmetType: 'SIGMET',
        hazard: 'TURB',
        severity: 'MODERATE',
        validTimeFrom: '2026-03-20T15:00:00Z',
        validTimeTo: '2026-03-20T19:00:00Z',
        altitudeLow: 25000,
        altitudeHigh: 40000,
        rawAirSigmet: 'SIGMET TURB SEV FL250-FL400',
        coords: [
          { lat: 50, lon: 5 },
          { lat: 52, lon: 10 },
          { lat: 48, lon: 12 },
        ],
      },
    ];

    const sigmets = parseSigmets(raw);
    expect(sigmets).toHaveLength(1);
    expect(sigmets[0].id).toBe('SIG001');
    expect(sigmets[0].type).toBe('SIGMET');
    expect(sigmets[0].hazard).toBe('TURB');
    expect(sigmets[0].severity).toBe('MODERATE');
    expect(sigmets[0].altitudeLow).toBe(25000);
    expect(sigmets[0].altitudeHigh).toBe(40000);
    expect(sigmets[0].geometry.type).toBe('Polygon');
  });

  it('should handle empty array', () => {
    expect(parseSigmets([])).toHaveLength(0);
  });

  it('should handle non-array input', () => {
    expect(parseSigmets(null)).toHaveLength(0);
    expect(parseSigmets('string')).toHaveLength(0);
  });

  it('should skip items without coordinates', () => {
    const raw = [{ airSigmetId: 'SIG001', hazard: 'TURB' }];
    expect(parseSigmets(raw)).toHaveLength(0);
  });

  it('should close polygon if not already closed', () => {
    const raw = [{
      airSigmetId: 'SIG001',
      coords: [
        { lat: 50, lon: 5 },
        { lat: 52, lon: 10 },
        { lat: 48, lon: 12 },
      ],
    }];

    const sigmets = parseSigmets(raw);
    const coords = sigmets[0].geometry.coordinates[0];
    expect(coords[0]).toEqual(coords[coords.length - 1]); // Closed
  });
});

// ---- RainViewer Tests ----

describe('buildRainViewerTileUrl', () => {
  it('should build correct tile URL', () => {
    const frame: RainViewerFrame = {
      time: 1710950400,
      path: '/v2/radar/1710950400',
    };
    const url = buildRainViewerTileUrl(frame, 'https://tilecache.rainviewer.com');
    expect(url).toBe('https://tilecache.rainviewer.com/v2/radar/1710950400/256/{z}/{x}/{y}/2/1_1.png');
  });
});

describe('getRadarFrames', () => {
  it('should combine past and nowcast frames', () => {
    const data: RainViewerData = {
      version: '2.0',
      generated: 1710950400,
      host: 'https://tilecache.rainviewer.com',
      radar: {
        past: [
          { time: 1710949800, path: '/v2/radar/1710949800' },
          { time: 1710950400, path: '/v2/radar/1710950400' },
        ],
        nowcast: [
          { time: 1710951000, path: '/v2/radar/1710951000' },
        ],
      },
      satellite: {
        infrared: [],
      },
    };

    const frames = getRadarFrames(data);
    expect(frames).toHaveLength(3);
    expect(frames[0].time).toBe(1710949800);
    expect(frames[2].time).toBe(1710951000);
  });

  it('should handle empty arrays', () => {
    const data: RainViewerData = {
      version: '2.0',
      generated: 0,
      host: '',
      radar: { past: [], nowcast: [] },
      satellite: { infrared: [] },
    };
    expect(getRadarFrames(data)).toHaveLength(0);
  });
});
