// ============================================================
// Phase 7: Social Profile Store
// LocalStorage-based CRUD for social media profiles
// Stores Twitch/YouTube/Instagram links per VATSIM CID
// ============================================================

import type { SocialProfile } from '@/types';

// ---- Configuration ----

const STORAGE_KEY = 'skybrief-radar-v2-profiles';
const SCHEMA_VERSION = 1;
const MAX_PROFILES = 10_000;
const MAX_USERNAME_LENGTH = 100;
const MAX_BIO_LENGTH = 500;
const MAX_URL_LENGTH = 300;

// ---- Types ----

interface StorageSchema {
  version: number;
  profiles: Record<string, SocialProfile>;
}

// ---- Validation ----

const TWITCH_USERNAME_RE = /^[a-zA-Z0-9_]{1,25}$/;
const YOUTUBE_HANDLE_RE = /^[a-zA-Z0-9_\-]{1,100}$/;
const INSTAGRAM_USERNAME_RE = /^[a-zA-Z0-9_.]{1,30}$/;
const URL_RE = /^https?:\/\/.{3,}$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a social profile before saving.
 */
export function validateProfile(profile: Partial<SocialProfile>): ValidationResult {
  const errors: string[] = [];

  if (profile.cid !== undefined && (typeof profile.cid !== 'number' || profile.cid < 1)) {
    errors.push('CID must be a positive number');
  }

  if (profile.twitch !== undefined && profile.twitch !== '') {
    if (!TWITCH_USERNAME_RE.test(profile.twitch)) {
      errors.push('Twitch username must be 1-25 alphanumeric characters or underscores');
    }
  }

  if (profile.youtube !== undefined && profile.youtube !== '') {
    if (!YOUTUBE_HANDLE_RE.test(profile.youtube) && profile.youtube.length > MAX_USERNAME_LENGTH) {
      errors.push('YouTube handle must be 1-100 valid characters');
    }
  }

  if (profile.instagram !== undefined && profile.instagram !== '') {
    if (!INSTAGRAM_USERNAME_RE.test(profile.instagram)) {
      errors.push('Instagram username must be 1-30 characters (letters, numbers, dots, underscores)');
    }
  }

  if (profile.streamUrl !== undefined && profile.streamUrl !== '') {
    if (!URL_RE.test(profile.streamUrl) || profile.streamUrl.length > MAX_URL_LENGTH) {
      errors.push('Stream URL must be a valid HTTP/HTTPS URL (max 300 chars)');
    }
  }

  if (profile.bio !== undefined && profile.bio.length > MAX_BIO_LENGTH) {
    errors.push(`Bio must be max ${MAX_BIO_LENGTH} characters`);
  }

  if (profile.avatarUrl !== undefined && profile.avatarUrl !== '') {
    if (!URL_RE.test(profile.avatarUrl) || profile.avatarUrl.length > MAX_URL_LENGTH) {
      errors.push('Avatar URL must be a valid HTTP/HTTPS URL');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---- Storage Access ----

/**
 * Load all profiles from localStorage.
 */
function loadStorage(): StorageSchema {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: SCHEMA_VERSION, profiles: {} };

    const data = JSON.parse(raw);

    // Schema migration (future-proof)
    if (!data.version || data.version < SCHEMA_VERSION) {
      return migrateSchema(data);
    }

    return data;
  } catch {
    console.warn('[Profile Store] Failed to load from localStorage, starting fresh');
    return { version: SCHEMA_VERSION, profiles: {} };
  }
}

/**
 * Save all profiles to localStorage.
 */
function saveStorage(schema: StorageSchema): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
    return true;
  } catch (error) {
    console.error('[Profile Store] Failed to save to localStorage:', error);
    return false;
  }
}

/**
 * Migrate older schema versions.
 */
function migrateSchema(data: unknown): StorageSchema {
  // V0 → V1: Just wrap in schema envelope
  if (data && typeof data === 'object' && !('version' in (data as Record<string, unknown>))) {
    return { version: SCHEMA_VERSION, profiles: data as Record<string, SocialProfile> };
  }
  return { version: SCHEMA_VERSION, profiles: {} };
}

// ---- CRUD Operations ----

/**
 * Get a profile by CID.
 */
export function getProfile(cid: number): SocialProfile | null {
  const storage = loadStorage();
  return storage.profiles[String(cid)] ?? null;
}

/**
 * Get all stored profiles.
 */
export function getAllProfiles(): SocialProfile[] {
  const storage = loadStorage();
  return Object.values(storage.profiles);
}

/**
 * Get all profiles as a Map keyed by CID (for pipeline merging).
 */
export function getProfilesMap(): Map<number, SocialProfile> {
  const storage = loadStorage();
  const map = new Map<number, SocialProfile>();
  for (const [cidStr, profile] of Object.entries(storage.profiles)) {
    map.set(Number(cidStr), profile);
  }
  return map;
}

/**
 * Save or update a profile.
 * Returns validation result — check .valid before assuming success.
 */
export function saveProfile(profile: SocialProfile): ValidationResult {
  // Normalize FIRST, then validate (so trim removes whitespace before regex check)
  const normalized: SocialProfile = {
    cid: profile.cid,
    twitch: profile.twitch?.trim().toLowerCase(),
    youtube: profile.youtube?.trim(),
    instagram: profile.instagram?.trim().toLowerCase(),
    streamUrl: profile.streamUrl?.trim(),
    bio: profile.bio?.trim(),
    avatarUrl: profile.avatarUrl?.trim(),
    updatedAt: Date.now(),
  };

  const validation = validateProfile(normalized);
  if (!validation.valid) return validation;

  const storage = loadStorage();

  // Check max profiles limit
  if (!storage.profiles[String(profile.cid)] && Object.keys(storage.profiles).length >= MAX_PROFILES) {
    return { valid: false, errors: [`Maximum ${MAX_PROFILES} profiles reached`] };
  }

  storage.profiles[String(profile.cid)] = normalized;
  const saved = saveStorage(storage);

  if (!saved) {
    return { valid: false, errors: ['Failed to save to localStorage (storage full?)'] };
  }

  return { valid: true, errors: [] };
}

/**
 * Delete a profile by CID.
 */
export function deleteProfile(cid: number): boolean {
  const storage = loadStorage();
  if (!storage.profiles[String(cid)]) return false;

  delete storage.profiles[String(cid)];
  return saveStorage(storage);
}

/**
 * Update specific fields of a profile (partial update).
 */
export function updateProfile(cid: number, updates: Partial<SocialProfile>): ValidationResult {
  const existing = getProfile(cid);
  if (!existing) {
    return { valid: false, errors: ['Profile not found'] };
  }

  const merged: SocialProfile = {
    ...existing,
    ...updates,
    cid, // CID cannot be changed
    updatedAt: Date.now(),
  };

  return saveProfile(merged);
}

/**
 * Get the number of stored profiles.
 */
export function getProfileCount(): number {
  const storage = loadStorage();
  return Object.keys(storage.profiles).length;
}

// ---- Export / Import ----

/**
 * Export all profiles as a JSON string (for backup).
 */
export function exportProfiles(): string {
  const storage = loadStorage();
  return JSON.stringify(storage, null, 2);
}

/**
 * Import profiles from a JSON string (from backup).
 * Validates each profile before importing.
 * Returns count of imported profiles.
 */
export function importProfiles(json: string): { imported: number; errors: string[] } {
  const errors: string[] = [];
  let imported = 0;

  try {
    const data = JSON.parse(json);
    const profiles: Record<string, SocialProfile> = data.profiles ?? data;

    for (const [cidStr, profile] of Object.entries(profiles)) {
      const cid = Number(cidStr);
      if (isNaN(cid) || cid < 1) {
        errors.push(`Invalid CID: ${cidStr}`);
        continue;
      }

      const profileWithCid = { ...profile, cid };
      const result = saveProfile(profileWithCid);
      if (result.valid) {
        imported++;
      } else {
        errors.push(`CID ${cid}: ${result.errors.join(', ')}`);
      }
    }
  } catch (error) {
    errors.push(`Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { imported, errors };
}

/**
 * Clear all profiles (for testing).
 */
export function _clearAllProfiles(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore in test environment without localStorage
  }
}
