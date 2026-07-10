import { describe, expect, it } from 'vitest';

import {
  METHOD_DELETE,
  METHOD_GET,
  METHOD_POST,
} from '../../common/constants';
import { getMethodPillClasses, getMethodTextClasses } from './method-colors';

describe('method-colors', () => {
  describe('getMethodPillClasses', () => {
    it('maps a known method to its theme background + font colour', () => {
      expect(getMethodPillClasses(METHOD_POST)).toContain('bg-(--color-success)');
      expect(getMethodPillClasses(METHOD_POST)).toContain('text-(--color-font-success)');
    });

    it('uses the bespoke GET colour with no darkening overlay', () => {
      expect(getMethodPillClasses(METHOD_GET)).toBe('bg-[#6B6296] text-white');
      expect(getMethodPillClasses(METHOD_GET)).not.toContain('linear-gradient');
    });

    it('darkens every themed non-GET method with a 40% black overlay', () => {
      expect(getMethodPillClasses(METHOD_DELETE)).toContain('linear-gradient(rgba(0,0,0,0.4),rgba(0,0,0,0.4))');
    });

    it('falls back to the neutral grey pill for unknown/custom methods (e.g. LINK)', () => {
      expect(getMethodPillClasses('LINK')).toBe('bg-[#424242] text-white');
    });
  });

  describe('getMethodTextClasses', () => {
    it('maps a known method to its theme text colour', () => {
      expect(getMethodTextClasses(METHOD_GET)).toBe('text-(--color-surprise)');
    });

    it('falls back to the default font colour for unknown/custom methods', () => {
      expect(getMethodTextClasses('PURGE')).toBe('text-(--color-font)');
    });
  });
});
