import { describe, it, expect } from 'vitest';
import { getRoutePilotCid } from './route';

describe('Route Layer State', () => {
  it('should start with no route displayed', () => {
    expect(getRoutePilotCid()).toBeNull();
  });
});
