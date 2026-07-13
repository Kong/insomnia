import { describe, expect, it } from 'vitest';

import { ALL_CAPABILITIES, TEMPLATE_TAG_BASELINE_CAPABILITIES } from './host-bridge';
import { ALL_SANDBOX_MODULES, TEMPLATE_TAG_BASELINE_MODULES } from './module-registry';
import {
  effectiveGrant,
  resolveTemplateTagCapabilities,
  resolveTemplateTagModules,
  SCRIPTING_PROFILE,
  TEMPLATE_TAG_PROFILE,
} from './surface-profiles';

describe('surface profiles (P1)', () => {
  describe('profile invariants', () => {
    it('every floor is within its ceiling', () => {
      for (const profile of [TEMPLATE_TAG_PROFILE, SCRIPTING_PROFILE]) {
        for (const m of profile.baselineModules) {
          expect(profile.moduleCeiling, `${profile.name} module floor ⊆ ceiling`).toContain(m);
        }
        for (const c of profile.baselineCapabilities) {
          expect(profile.capabilityCeiling, `${profile.name} capability floor ⊆ ceiling`).toContain(c);
        }
      }
    });

    it('the template-tag profile excludes credentials from its capability ceiling', () => {
      // Cloud-credential access is reserved for first-party bundle plugins; a user template-tag
      // plugin must never be able to obtain it, even by declaring it.
      expect(TEMPLATE_TAG_PROFILE.capabilityCeiling).not.toContain('credentials');
    });

    it('the scripting profile ceiling is the full capability + module set', () => {
      expect([...SCRIPTING_PROFILE.capabilityCeiling].sort()).toEqual([...ALL_CAPABILITIES].sort());
      expect([...SCRIPTING_PROFILE.moduleCeiling].sort()).toEqual([...ALL_SANDBOX_MODULES].sort());
    });
  });

  describe('effectiveGrant', () => {
    it('is floor ∪ (declared ∩ ceiling)', () => {
      expect(effectiveGrant(['a'], ['a', 'b', 'c'], ['b', 'zzz'])).toEqual(['a', 'b']);
    });
    it('drops declared names outside the ceiling', () => {
      expect(effectiveGrant(['a'], ['a', 'b'], ['c'])).toEqual(['a']);
    });
    it('never duplicates a floor member that is also declared', () => {
      expect(effectiveGrant(['a'], ['a', 'b'], ['a', 'b'])).toEqual(['a', 'b']);
    });
    it('applies the normalize function before the ceiling check', () => {
      expect(effectiveGrant([], ['events'], ['node:events'], n => (n === 'node:events' ? 'events' : n))).toEqual([
        'events',
      ]);
    });
  });

  describe('resolveTemplateTagCapabilities (profile ceiling enforced)', () => {
    it('defaults to the baseline floor', () => {
      expect(resolveTemplateTagCapabilities()).toEqual(TEMPLATE_TAG_BASELINE_CAPABILITIES);
    });
    it('grants a declared in-ceiling capability', () => {
      expect(resolveTemplateTagCapabilities(['network'])).toEqual([...TEMPLATE_TAG_BASELINE_CAPABILITIES, 'network']);
    });
    it('drops a declared capability above the ceiling (credentials), even though it is a real Capability', () => {
      expect(resolveTemplateTagCapabilities(['credentials'])).toEqual(TEMPLATE_TAG_BASELINE_CAPABILITIES);
    });
    it('drops unknown capability names', () => {
      expect(resolveTemplateTagCapabilities(['totally-made-up'])).toEqual(TEMPLATE_TAG_BASELINE_CAPABILITIES);
    });
  });

  describe('resolveTemplateTagModules (no resolve-time ceiling — registry is the gate)', () => {
    it('defaults to the baseline floor', () => {
      expect(resolveTemplateTagModules()).toEqual(TEMPLATE_TAG_BASELINE_MODULES);
    });
    it('grants a declared registry module and canonicalizes the node: alias', () => {
      expect(resolveTemplateTagModules(['node:events'])).toEqual([...TEMPLATE_TAG_BASELINE_MODULES, 'events']);
    });
    it('passes an unregistered declared module through (require reports "not available")', () => {
      // Not dropped at resolve time — the require gate gives the precise message, and an
      // unregistered name has no factory so it grants no code regardless.
      expect(resolveTemplateTagModules(['left-pad'])).toEqual([...TEMPLATE_TAG_BASELINE_MODULES, 'left-pad']);
    });
  });
});
