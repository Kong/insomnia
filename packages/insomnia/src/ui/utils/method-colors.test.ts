import { describe, expect, it } from 'vitest';

import {
  METHOD_DELETE,
  METHOD_GET,
  METHOD_POST,
} from '../../common/constants';
import { getMethodPillClasses, getMethodTextClasses } from './method-colors';

describe('method-colors', () => {
  describe('getMethodPillClasses', () => {
    it('maps a known method to a tint of its theme colour', () => {
      expect(getMethodPillClasses(METHOD_POST)).toContain('var(--color-success)');
      expect(getMethodPillClasses(METHOD_POST)).toContain('text-(--color-success)');
      expect(getMethodPillClasses(METHOD_GET)).toContain('text-(--color-surprise)');
      expect(getMethodPillClasses(METHOD_DELETE)).toContain('text-(--color-danger)');
    });

    it('falls back to the neutral pill for unknown/custom methods (e.g. LINK)', () => {
      expect(getMethodPillClasses('LINK')).toBe('bg-(--hl-sm) text-(--color-font)');
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
