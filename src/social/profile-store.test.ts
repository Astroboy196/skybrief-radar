import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateProfile,
  getProfile,
  getAllProfiles,
  getProfilesMap,
  saveProfile,
  deleteProfile,
  updateProfile,
  getProfileCount,
  exportProfiles,
  importProfiles,
  _clearAllProfiles,
} from './profile-store';
import type { SocialProfile } from '@/types';

// ---- Mock localStorage ----

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  _clearAllProfiles();
});

// ---- Helper ----

function createTestProfile(overrides: Partial<SocialProfile> = {}): SocialProfile {
  return {
    cid: 1234567,
    twitch: 'testpilot',
    youtube: 'TestChannel',
    instagram: 'test.pilot',
    streamUrl: 'https://twitch.tv/testpilot',
    bio: 'I fly planes virtually!',
    avatarUrl: 'https://example.com/avatar.jpg',
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ---- Validation Tests ----

describe('validateProfile', () => {
  it('should validate a correct profile', () => {
    const result = validateProfile(createTestProfile());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject negative CID', () => {
    const result = validateProfile({ cid: -1 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('CID');
  });

  it('should reject CID of 0', () => {
    const result = validateProfile({ cid: 0 });
    expect(result.valid).toBe(false);
  });

  it('should accept valid Twitch username', () => {
    expect(validateProfile({ twitch: 'user_name123' }).valid).toBe(true);
  });

  it('should reject Twitch username with spaces', () => {
    expect(validateProfile({ twitch: 'user name' }).valid).toBe(false);
  });

  it('should reject Twitch username > 25 chars', () => {
    expect(validateProfile({ twitch: 'a'.repeat(26) }).valid).toBe(false);
  });

  it('should accept empty Twitch username', () => {
    expect(validateProfile({ twitch: '' }).valid).toBe(true);
  });

  it('should accept valid Instagram username', () => {
    expect(validateProfile({ instagram: 'pilot.joe_123' }).valid).toBe(true);
  });

  it('should reject Instagram username with spaces', () => {
    expect(validateProfile({ instagram: 'pilot joe' }).valid).toBe(false);
  });

  it('should reject Instagram username > 30 chars', () => {
    expect(validateProfile({ instagram: 'a'.repeat(31) }).valid).toBe(false);
  });

  it('should accept valid stream URL', () => {
    expect(validateProfile({ streamUrl: 'https://twitch.tv/user' }).valid).toBe(true);
  });

  it('should reject invalid stream URL', () => {
    expect(validateProfile({ streamUrl: 'not-a-url' }).valid).toBe(false);
  });

  it('should accept empty stream URL', () => {
    expect(validateProfile({ streamUrl: '' }).valid).toBe(true);
  });

  it('should reject bio > 500 chars', () => {
    expect(validateProfile({ bio: 'a'.repeat(501) }).valid).toBe(false);
  });

  it('should accept bio <= 500 chars', () => {
    expect(validateProfile({ bio: 'a'.repeat(500) }).valid).toBe(true);
  });

  it('should reject invalid avatar URL', () => {
    expect(validateProfile({ avatarUrl: 'not-a-url' }).valid).toBe(false);
  });

  it('should accept valid avatar URL', () => {
    expect(validateProfile({ avatarUrl: 'https://example.com/pic.jpg' }).valid).toBe(true);
  });

  it('should accept empty avatar URL', () => {
    expect(validateProfile({ avatarUrl: '' }).valid).toBe(true);
  });

  it('should collect multiple errors', () => {
    const result = validateProfile({
      cid: -1,
      twitch: 'invalid user name!!!',
      instagram: 'a'.repeat(31),
      bio: 'x'.repeat(501),
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

// ---- CRUD Tests ----

describe('saveProfile + getProfile', () => {
  it('should save and retrieve a profile', () => {
    const profile = createTestProfile();
    const result = saveProfile(profile);
    expect(result.valid).toBe(true);

    const loaded = getProfile(1234567);
    expect(loaded).not.toBeNull();
    expect(loaded!.twitch).toBe('testpilot');
    expect(loaded!.youtube).toBe('TestChannel');
    expect(loaded!.instagram).toBe('test.pilot');
  });

  it('should normalize values on save', () => {
    saveProfile(createTestProfile({
      twitch: '  TestPilot  ',
      instagram: '  Test.Pilot  ',
    }));
    const loaded = getProfile(1234567);
    expect(loaded!.twitch).toBe('testpilot'); // trimmed + lowercased
    expect(loaded!.instagram).toBe('test.pilot'); // trimmed + lowercased
  });

  it('should return null for non-existent profile', () => {
    expect(getProfile(99999)).toBeNull();
  });

  it('should overwrite existing profile', () => {
    saveProfile(createTestProfile({ twitch: 'first' }));
    saveProfile(createTestProfile({ twitch: 'second' }));
    expect(getProfile(1234567)!.twitch).toBe('second');
  });

  it('should not save invalid profile', () => {
    const result = saveProfile(createTestProfile({ cid: -1 }));
    expect(result.valid).toBe(false);
    expect(getProfile(-1)).toBeNull();
  });

  it('should set updatedAt timestamp', () => {
    const before = Date.now();
    saveProfile(createTestProfile());
    const loaded = getProfile(1234567);
    expect(loaded!.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('deleteProfile', () => {
  it('should delete an existing profile', () => {
    saveProfile(createTestProfile());
    expect(getProfile(1234567)).not.toBeNull();

    const deleted = deleteProfile(1234567);
    expect(deleted).toBe(true);
    expect(getProfile(1234567)).toBeNull();
  });

  it('should return false for non-existent profile', () => {
    expect(deleteProfile(99999)).toBe(false);
  });
});

describe('updateProfile', () => {
  it('should update specific fields', () => {
    saveProfile(createTestProfile());
    const result = updateProfile(1234567, { twitch: 'newname' });
    expect(result.valid).toBe(true);

    const loaded = getProfile(1234567);
    expect(loaded!.twitch).toBe('newname');
    expect(loaded!.youtube).toBe('TestChannel'); // unchanged
  });

  it('should fail for non-existent profile', () => {
    const result = updateProfile(99999, { twitch: 'test' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });

  it('should validate updated fields', () => {
    saveProfile(createTestProfile());
    const result = updateProfile(1234567, { twitch: 'invalid name!!' });
    expect(result.valid).toBe(false);
  });

  it('should not allow changing CID via update', () => {
    saveProfile(createTestProfile({ cid: 111 }));
    updateProfile(111, { cid: 999 } as any);
    expect(getProfile(111)).not.toBeNull();
  });
});

// ---- Collection Tests ----

describe('getAllProfiles', () => {
  it('should return empty array when no profiles', () => {
    expect(getAllProfiles()).toHaveLength(0);
  });

  it('should return all saved profiles', () => {
    saveProfile(createTestProfile({ cid: 1 }));
    saveProfile(createTestProfile({ cid: 2 }));
    saveProfile(createTestProfile({ cid: 3 }));
    expect(getAllProfiles()).toHaveLength(3);
  });
});

describe('getProfilesMap', () => {
  it('should return Map keyed by CID', () => {
    saveProfile(createTestProfile({ cid: 111 }));
    saveProfile(createTestProfile({ cid: 222 }));

    const map = getProfilesMap();
    expect(map.size).toBe(2);
    expect(map.get(111)!.cid).toBe(111);
    expect(map.get(222)!.cid).toBe(222);
  });
});

describe('getProfileCount', () => {
  it('should return 0 when empty', () => {
    expect(getProfileCount()).toBe(0);
  });

  it('should count correctly', () => {
    saveProfile(createTestProfile({ cid: 1 }));
    saveProfile(createTestProfile({ cid: 2 }));
    expect(getProfileCount()).toBe(2);
  });
});

// ---- Export / Import Tests ----

describe('exportProfiles', () => {
  it('should export valid JSON', () => {
    saveProfile(createTestProfile({ cid: 111 }));
    const json = exportProfiles();
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(1);
    expect(parsed.profiles['111']).toBeDefined();
  });

  it('should export empty when no profiles', () => {
    const json = exportProfiles();
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed.profiles)).toHaveLength(0);
  });
});

describe('importProfiles', () => {
  it('should import valid profiles', () => {
    const data = {
      version: 1,
      profiles: {
        '111': createTestProfile({ cid: 111 }),
        '222': createTestProfile({ cid: 222 }),
      },
    };
    const result = importProfiles(JSON.stringify(data));
    expect(result.imported).toBe(2);
    expect(result.errors).toHaveLength(0);
    expect(getProfileCount()).toBe(2);
  });

  it('should skip invalid CIDs during import', () => {
    const data = {
      profiles: {
        'abc': createTestProfile({ cid: 111 }),
        '222': createTestProfile({ cid: 222 }),
      },
    };
    const result = importProfiles(JSON.stringify(data));
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('should handle invalid JSON', () => {
    const result = importProfiles('not-json');
    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('parse');
  });

  it('should roundtrip export → import', () => {
    saveProfile(createTestProfile({ cid: 111, twitch: 'original' }));
    saveProfile(createTestProfile({ cid: 222, twitch: 'second' }));

    const exported = exportProfiles();
    _clearAllProfiles();
    expect(getProfileCount()).toBe(0);

    const result = importProfiles(exported);
    expect(result.imported).toBe(2);
    expect(getProfile(111)!.twitch).toBe('original');
    expect(getProfile(222)!.twitch).toBe('second');
  });
});
