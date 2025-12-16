import { describe, expect, test } from '@jest/globals';
import { isAlienZone, getTokenName, getZoneName } from '../scripts/lib/lib.js';

describe('Alien Zones Utilities', () => {
  describe('isAlienZone', () => {
    test('returns true when region has alien-zones flag set to true', () => {
      const region = {
        flags: {
          "alien-zones": {
            isAlienZone: true
          }
        }
      };
      expect(isAlienZone(region)).toBe(true);
    });

    test('returns false when region has no flags', () => {
      const region = {};
      expect(isAlienZone(region)).toBe(false);
    });

    test('returns false when alien-zones flag is false', () => {
      const region = {
        flags: {
          "alien-zones": {
            isAlienZone: false
          }
        }
      };
      expect(isAlienZone(region)).toBe(false);
    });

    test('returns false when alien-zones flag is missing', () => {
      const region = {
        flags: {
          "other-module": {}
        }
      };
      expect(isAlienZone(region)).toBe(false);
    });

    test('returns false when flags is null', () => {
      const region = {
        flags: null
      };
      expect(isAlienZone(region)).toBe(false);
    });

    test('returns false when flags is undefined', () => {
      const region = {
        flags: undefined
      };
      expect(isAlienZone(region)).toBe(false);
    });
  });

  describe('getTokenName', () => {
    test('returns token name when present', () => {
      const token = { name: 'Ripley' };
      expect(getTokenName(token)).toBe('Ripley');
    });

    test('returns "Unknown Token" when name is missing', () => {
      const token = {};
      expect(getTokenName(token)).toBe('Unknown Token');
    });

    test('returns "Unknown Token" when name is empty string', () => {
      const token = { name: '' };
      expect(getTokenName(token)).toBe('Unknown Token');
    });

    test('returns "Unknown Token" when name is null', () => {
      const token = { name: null };
      expect(getTokenName(token)).toBe('Unknown Token');
    });
  });

  describe('getZoneName', () => {
    test('returns region name when present', () => {
      const region = { name: 'Landing Bay' };
      expect(getZoneName(region)).toBe('Landing Bay');
    });

    test('returns "Unknown Zone" when name is missing', () => {
      const region = {};
      expect(getZoneName(region)).toBe('Unknown Zone');
    });

    test('returns "Unknown Zone" when name is empty string', () => {
      const region = { name: '' };
      expect(getZoneName(region)).toBe('Unknown Zone');
    });

    test('returns "Unknown Zone" when name is null', () => {
      const region = { name: null };
      expect(getZoneName(region)).toBe('Unknown Zone');
    });
  });
});
