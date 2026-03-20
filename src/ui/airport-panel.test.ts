import { describe, it, expect, beforeEach } from 'vitest';
import { isAirportPanelOpen, closeAirportPanel } from './airport-panel';

beforeEach(() => {
  closeAirportPanel();
});

describe('Airport Panel State', () => {
  it('should start with panel closed', () => {
    expect(isAirportPanelOpen()).toBe(false);
  });

  it('should close gracefully when no panel exists', () => {
    expect(() => closeAirportPanel()).not.toThrow();
  });

  it('should export all public functions', () => {
    expect(typeof isAirportPanelOpen).toBe('function');
    expect(typeof closeAirportPanel).toBe('function');
  });
});
