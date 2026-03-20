import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseAllRemarksUrls,
  normalizeTwitchUsername,
  normalizeYoutubeHandle,
  buildStreamingStatus,
  buildAllStreamingStatuses,
  getLiveStreamerCount,
  _resetStreaming,
  _setMockLiveStatuses,
} from './streaming';
import type { VatsimPilot, SocialProfile } from '@/types';

// ---- Helpers ----

function mockPilot(cid: number, callsign: string, remarks: string): VatsimPilot {
  return {
    cid,
    name: 'Test',
    callsign,
    server: 'UK-1',
    pilot_rating: 0,
    military_rating: 0,
    latitude: 0,
    longitude: 0,
    altitude: 0,
    groundspeed: 0,
    transponder: '0000',
    heading: 0,
    qnh_i_hg: 29.92,
    qnh_mb: 1013,
    flight_plan: {
      flight_rules: 'I',
      aircraft: 'B738',
      aircraft_faa: 'B738',
      aircraft_short: 'B738',
      departure: 'EGLL',
      arrival: 'LSZH',
      alternate: '',
      deptime: '1400',
      enroute_time: '0130',
      fuel_time: '0400',
      remarks,
      route: 'DCT',
      revision_id: 1,
      assigned_transponder: '0000',
    },
    logon_time: '',
    last_updated: '',
  };
}

function mockProfile(cid: number, twitch?: string, youtube?: string): SocialProfile {
  return {
    cid,
    twitch,
    youtube,
    updatedAt: Date.now(),
  };
}

// ---- Setup ----

beforeEach(() => {
  _resetStreaming();
});

// ---- Remarks Parsing Tests ----

describe('parseAllRemarksUrls', () => {
  it('should extract Twitch URLs from pilot remarks', () => {
    const pilots = [
      mockPilot(1, 'BAW1', 'PBN/A1 /v/ twitch.tv/streamer1'),
      mockPilot(2, 'DLH2', 'OPR/DLH no stream here'),
      mockPilot(3, 'SWR3', 'https://www.twitch.tv/Pilot3 /v/'),
    ];

    const results = parseAllRemarksUrls(pilots);
    expect(results.size).toBe(2);
    expect(results.get(1)?.twitch).toBe('streamer1');
    expect(results.get(3)?.twitch).toBe('pilot3');
    expect(results.has(2)).toBe(false);
  });

  it('should extract YouTube URLs', () => {
    const pilots = [
      mockPilot(1, 'AAL1', 'youtube.com/@AvPilot /v/'),
    ];

    const results = parseAllRemarksUrls(pilots);
    expect(results.get(1)?.youtube).toBe('AvPilot');
  });

  it('should handle pilots without flight plan', () => {
    const pilot: VatsimPilot = {
      ...mockPilot(1, 'TEST', ''),
      flight_plan: null,
    };
    const results = parseAllRemarksUrls([pilot]);
    expect(results.size).toBe(0);
  });

  it('should handle empty pilot list', () => {
    expect(parseAllRemarksUrls([]).size).toBe(0);
  });
});

// ---- Twitch Username Normalization ----

describe('normalizeTwitchUsername', () => {
  it('should extract from full URL', () => {
    expect(normalizeTwitchUsername('https://twitch.tv/johndoe')).toBe('johndoe');
  });

  it('should extract from URL with www', () => {
    expect(normalizeTwitchUsername('https://www.twitch.tv/JohnDoe')).toBe('johndoe');
  });

  it('should extract from http URL', () => {
    expect(normalizeTwitchUsername('http://twitch.tv/user123')).toBe('user123');
  });

  it('should handle bare username', () => {
    expect(normalizeTwitchUsername('johndoe')).toBe('johndoe');
  });

  it('should strip query params', () => {
    expect(normalizeTwitchUsername('https://twitch.tv/user?ref=share')).toBe('user');
  });

  it('should strip trailing slash', () => {
    expect(normalizeTwitchUsername('https://twitch.tv/user/')).toBe('user');
  });

  it('should lowercase', () => {
    expect(normalizeTwitchUsername('UPPERCASE_USER')).toBe('uppercase_user');
  });

  it('should trim whitespace', () => {
    expect(normalizeTwitchUsername('  user  ')).toBe('user');
  });

  it('should return empty for empty input', () => {
    expect(normalizeTwitchUsername('')).toBe('');
  });
});

// ---- YouTube Handle Normalization ----

describe('normalizeYoutubeHandle', () => {
  it('should extract from @handle URL', () => {
    expect(normalizeYoutubeHandle('https://youtube.com/@PilotJoe')).toBe('PilotJoe');
  });

  it('should extract from channel URL', () => {
    expect(normalizeYoutubeHandle('https://youtube.com/c/AvChannel')).toBe('AvChannel');
  });

  it('should extract from channel ID URL', () => {
    expect(normalizeYoutubeHandle('https://youtube.com/channel/UCxxxx')).toBe('UCxxxx');
  });

  it('should handle bare handle', () => {
    expect(normalizeYoutubeHandle('PilotJoe')).toBe('PilotJoe');
  });

  it('should strip query params', () => {
    expect(normalizeYoutubeHandle('https://youtube.com/@user?sub=1')).toBe('user');
  });

  it('should return empty for empty input', () => {
    expect(normalizeYoutubeHandle('')).toBe('');
  });
});

// ---- Stream Status Building Tests ----

describe('buildStreamingStatus', () => {
  it('should return "none" when no stream info available', () => {
    const status = buildStreamingStatus(123, null, undefined);
    expect(status.isLive).toBe(false);
    expect(status.platform).toBe('none');
    expect(status.username).toBe('');
  });

  it('should use Profile Store twitch as priority 1', () => {
    const profile = mockProfile(123, 'profileuser');
    const remarks = { twitch: 'remarksuser' };
    const status = buildStreamingStatus(123, profile, remarks);
    expect(status.username).toBe('profileuser');
    expect(status.platform).toBe('twitch');
  });

  it('should use Remarks twitch as priority 2 when no profile', () => {
    const status = buildStreamingStatus(123, null, { twitch: 'remarksuser' });
    expect(status.username).toBe('remarksuser');
    expect(status.platform).toBe('twitch');
  });

  it('should detect LIVE status from mock Twitch API data', () => {
    _setMockLiveStatuses(new Map([
      ['liveuser', {
        user_login: 'liveuser',
        user_name: 'LiveUser',
        title: 'Flying EGLL-LSZH!',
        viewer_count: 42,
        thumbnail_url: 'https://thumb/{width}x{height}.jpg',
        type: 'live',
      }],
    ]));

    const profile = mockProfile(123, 'liveuser');
    const status = buildStreamingStatus(123, profile, undefined);

    expect(status.isLive).toBe(true);
    expect(status.platform).toBe('twitch');
    expect(status.username).toBe('liveuser');
    expect(status.viewerCount).toBe(42);
    expect(status.title).toBe('Flying EGLL-LSZH!');
    expect(status.streamUrl).toBe('https://twitch.tv/liveuser');
    expect(status.thumbnailUrl).toBe('https://thumb/320x180.jpg');
  });

  it('should show offline when has twitch but not live', () => {
    _setMockLiveStatuses(new Map()); // Nobody is live

    const profile = mockProfile(123, 'offlineuser');
    const status = buildStreamingStatus(123, profile, undefined);

    expect(status.isLive).toBe(false);
    expect(status.platform).toBe('twitch');
    expect(status.username).toBe('offlineuser');
    expect(status.streamUrl).toBe('https://twitch.tv/offlineuser');
  });

  it('should fall back to YouTube when no Twitch', () => {
    const profile = mockProfile(123, undefined, 'PilotYT');
    const status = buildStreamingStatus(123, profile, undefined);

    expect(status.platform).toBe('youtube');
    expect(status.username).toBe('PilotYT');
    expect(status.streamUrl).toContain('youtube.com/@PilotYT');
  });

  it('should prefer Twitch over YouTube', () => {
    const profile = mockProfile(123, 'twitchuser', 'youtubeuser');
    const status = buildStreamingStatus(123, profile, undefined);

    expect(status.platform).toBe('twitch');
    expect(status.username).toBe('twitchuser');
  });
});

// ---- Batch Status Building ----

describe('buildAllStreamingStatuses', () => {
  it('should build statuses for all pilots with stream info', () => {
    const pilots = [
      mockPilot(1, 'BAW1', 'twitch.tv/pilot1'),
      mockPilot(2, 'DLH2', 'no stream'),
      mockPilot(3, 'SWR3', 'twitch.tv/pilot3'),
    ];

    const profiles = new Map<number, SocialProfile>();
    const statuses = buildAllStreamingStatuses(pilots, profiles);

    expect(statuses.size).toBe(2); // Only pilots with stream URLs
    expect(statuses.get(1)?.username).toBe('pilot1');
    expect(statuses.get(3)?.username).toBe('pilot3');
    expect(statuses.has(2)).toBe(false);
  });

  it('should merge profile store with remarks', () => {
    const pilots = [
      mockPilot(1, 'BAW1', 'twitch.tv/remarksname'),
    ];

    // Profile overrides remarks
    const profiles = new Map([
      [1, mockProfile(1, 'profilename')],
    ]);

    const statuses = buildAllStreamingStatuses(pilots, profiles);
    expect(statuses.get(1)?.username).toBe('profilename');
  });

  it('should handle empty inputs', () => {
    const statuses = buildAllStreamingStatuses([], new Map());
    expect(statuses.size).toBe(0);
  });
});

// ---- Live Streamer Count ----

describe('getLiveStreamerCount', () => {
  it('should return 0 initially', () => {
    expect(getLiveStreamerCount()).toBe(0);
  });

  it('should reflect mock live statuses', () => {
    _setMockLiveStatuses(new Map([
      ['user1', { user_login: 'user1', user_name: 'U1', title: '', viewer_count: 10, thumbnail_url: '', type: 'live' }],
      ['user2', { user_login: 'user2', user_name: 'U2', title: '', viewer_count: 5, thumbnail_url: '', type: 'live' }],
    ]));
    expect(getLiveStreamerCount()).toBe(2);
  });
});
