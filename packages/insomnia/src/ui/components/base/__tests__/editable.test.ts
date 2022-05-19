import { describe, expect, it } from '@jest/globals';

import { shouldSave } from '../editable';

describe('shouldSave', () => {
  it('should save if new and old are not the same', () => {
    expect(shouldSave('old', 'new')).toBe(true);
  });

  it('should not save if new and old are the same', () => {
    expect(shouldSave('old', 'old')).toBe(false);
  });

  it('should save if new is empty and we are not preventing blank', () => {
    expect(shouldSave('old', '', false)).toBe(true);
  });

  it('should not save if new is empty and we are preventing blank', () => {
    expect(shouldSave('old', '', true)).toBe(false);
  });
});
