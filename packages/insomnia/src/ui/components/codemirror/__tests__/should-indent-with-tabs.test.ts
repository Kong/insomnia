import { describe, expect, it } from '@jest/globals';

import { shouldIndentWithTabs } from '../code-editor';

describe('shouldIndentWithTabs()', () => {
  it('should return false if mode contains yaml', () => {
    expect(shouldIndentWithTabs({ mode: 'text/yaml', indentWithTabs: true })).toBe(false);
  });

  it('should return false if preference is disabled', () => {
    expect(shouldIndentWithTabs({ mode: 'text/json', indentWithTabs: false })).toBe(false);
  });

  it('should return true if preference is enabled', () => {
    expect(shouldIndentWithTabs({ mode: 'text/json', indentWithTabs: true })).toBe(true);
  });

  it('should return false if mode is openapi', () => {
    expect(shouldIndentWithTabs({ mode: 'openapi', indentWithTabs: true })).toBe(false);
  });
});
