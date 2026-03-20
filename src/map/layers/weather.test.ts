import { describe, it, expect } from 'vitest';
import {
  getCurrentRadarTimestamp,
  isRadarAnimating,
  isRadarVisible,
  isSigmetVisible,
} from './weather';

describe('Weather Overlay State', () => {
  it('should start with radar hidden', () => {
    expect(isRadarVisible()).toBe(false);
  });

  it('should start with animation stopped', () => {
    expect(isRadarAnimating()).toBe(false);
  });

  it('should start with sigmets hidden', () => {
    expect(isSigmetVisible()).toBe(false);
  });

  it('should return --:-- for timestamp when no data', () => {
    expect(getCurrentRadarTimestamp()).toBe('--:--');
  });
});
