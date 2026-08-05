import { describe, expect, it } from 'vitest';

import { parsePluginPermissions } from './permissions';

describe('parsePluginPermissions', () => {
  it('treats a missing permissions block as baseline (not declared, no warnings)', () => {
    const result = parsePluginPermissions({ description: 'x' });
    expect(result).toEqual({ permissions: { modules: [], capabilities: [] }, warnings: [], declared: false });
  });

  it('parses a valid permissions block', () => {
    const result = parsePluginPermissions({ permissions: { modules: ['events', 'crypto'], capabilities: ['storage'] } });
    expect(result.permissions).toEqual({ modules: ['events', 'crypto'], capabilities: ['storage'] });
    expect(result.warnings).toEqual([]);
    expect(result.declared).toBe(true);
  });

  it('accepts a declared-but-empty permissions block', () => {
    const result = parsePluginPermissions({ permissions: {} });
    expect(result.permissions).toEqual({ modules: [], capabilities: [] });
    expect(result.declared).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('de-duplicates repeated module names', () => {
    const result = parsePluginPermissions({ permissions: { modules: ['events', 'events', 'path'] } });
    expect(result.permissions.modules).toEqual(['events', 'path']);
  });

  it('keeps unknown module names (grant vs. availability are separate concerns)', () => {
    // Unknown names are not rejected at parse — they fail later at require() with "not available".
    const result = parsePluginPermissions({ permissions: { modules: ['left-pad'] } });
    expect(result.permissions.modules).toEqual(['left-pad']);
    expect(result.warnings).toEqual([]);
  });

  it('degrades a non-array modules axis to empty with a warning (never throws)', () => {
    const result = parsePluginPermissions({ permissions: { modules: 'events' } });
    expect(result.permissions.modules).toEqual([]);
    expect(result.declared).toBe(true);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/modules must be an array/);
  });

  it('drops non-string array entries with a warning', () => {
    const result = parsePluginPermissions({ permissions: { modules: ['events', 42, '', null] } });
    expect(result.permissions.modules).toEqual(['events']);
    expect(result.warnings).toHaveLength(3);
  });

  it('degrades a non-object permissions field with a warning', () => {
    const result = parsePluginPermissions({ permissions: ['events'] });
    expect(result.permissions).toEqual({ modules: [], capabilities: [] });
    expect(result.declared).toBe(false);
    expect(result.warnings[0]).toMatch(/permissions must be an object/);
  });

  it('handles a non-object insomnia field', () => {
    expect(parsePluginPermissions(null)).toEqual({
      permissions: { modules: [], capabilities: [] },
      warnings: [],
      declared: false,
    });
    expect(parsePluginPermissions('nope')).toEqual({
      permissions: { modules: [], capabilities: [] },
      warnings: [],
      declared: false,
    });
  });
});
