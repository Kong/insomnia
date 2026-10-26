/**
 * Per-surface sandbox profiles (sandbox plan P1). A profile is the *ceiling* of what a plugin on a
 * given surface may ever be granted, plus the *floor* it always gets. The effective grant is:
 *
 *     floor ∪ (declared ∩ ceiling)
 *
 * so declaring a module/capability outside the surface's ceiling grants nothing — a manifest can't
 * self-escalate past what the surface allows. Bundle (first-party) plugins bypass profiles entirely
 * (they are trusted and get everything); profiles constrain *user* plugins.
 */

import { ALL_CAPABILITIES, type Capability, TEMPLATE_TAG_BASELINE_CAPABILITIES } from './host-bridge';
import { ALL_SANDBOX_MODULES, canonicalizeModule, TEMPLATE_TAG_BASELINE_MODULES } from './module-registry';

export interface SurfaceProfile {
  name: string;
  /** Every module a plugin on this surface may be granted (superset of the floor). */
  moduleCeiling: string[];
  /** Every capability a plugin on this surface may be granted (superset of the floor). */
  capabilityCeiling: Capability[];
  /** Modules granted with no manifest. */
  baselineModules: string[];
  /** Capabilities granted with no manifest. */
  baselineCapabilities: Capability[];
}

/**
 * Template tags (constrained). Notably `credentials` is **not** in the capability ceiling: reading
 * or writing cloud-provider credentials is reserved for first-party bundle plugins (external-vault
 * et al.), so a user template-tag plugin can never obtain it, even by declaring it. Modules are
 * unrestricted up to the registry — every registered module is a vetted safe equivalent.
 */
export const TEMPLATE_TAG_PROFILE: SurfaceProfile = {
  name: 'template-tag',
  moduleCeiling: ALL_SANDBOX_MODULES,
  capabilityCeiling: ['render', 'models.read', 'util', 'crypto', 'network', 'storage', 'fs-read', 'app'],
  baselineModules: TEMPLATE_TAG_BASELINE_MODULES,
  baselineCapabilities: TEMPLATE_TAG_BASELINE_CAPABILITIES,
};

/**
 * Pre/post-request scripting engine (broad). Scripts legitimately need a wide `pm.*`/`insomnia`
 * surface, so the ceiling is everything — but it is still *enumerated*, not literally raw Node.
 * Defined here for reuse; the scripting surface adopts the sandbox in later work, so nothing wires
 * this profile to a live execution path yet (unit-tested only).
 */
export const SCRIPTING_PROFILE: SurfaceProfile = {
  name: 'scripting',
  moduleCeiling: ALL_SANDBOX_MODULES,
  capabilityCeiling: ALL_CAPABILITIES,
  baselineModules: ALL_SANDBOX_MODULES,
  baselineCapabilities: ALL_CAPABILITIES,
};

/**
 * The core grant computation: the floor plus any declared names that fall within the ceiling.
 * `normalize` canonicalizes a declared name before the ceiling check (e.g. `node:events` → `events`)
 * so aliases resolve correctly; capabilities pass through unchanged.
 */
const effectiveGrant = (
  floor: string[],
  ceiling: string[],
  declared: string[],
  normalize: (name: string) => string = name => name,
): string[] => {
  const ceilingSet = new Set(ceiling);
  const resolved = [...floor];
  for (const raw of declared) {
    const name = normalize(raw);
    if (ceilingSet.has(name) && !resolved.includes(name)) {
      resolved.push(name);
    }
  }
  return resolved;
};

/**
 * Resolve the module grant for a template-tag plugin: baseline ∪ declared (canonicalized). Modules
 * are NOT filtered by a resolve-time ceiling — the registry is the effective gate: a declared but
 * unregistered module (e.g. a not-yet-shipped npm lib) is passed through to `require`, which reports
 * the precise "not available in sandbox" rather than a misleading "not permitted by manifest". Every
 * registered module is a vetted safe equivalent, so there is nothing to exclude at this surface.
 */
export const resolveTemplateTagModules = (declaredModules: string[] = []): string[] => {
  const resolved = [...TEMPLATE_TAG_PROFILE.baselineModules];
  for (const name of declaredModules) {
    const canonical = canonicalizeModule(name);
    if (!resolved.includes(canonical)) {
      resolved.push(canonical);
    }
  }
  return resolved;
};

/** Resolve the capability grant for a template-tag plugin: baseline ∪ (declared ∩ ceiling). */
export const resolveTemplateTagCapabilities = (declaredCapabilities: string[] = []): string[] =>
  effectiveGrant(
    TEMPLATE_TAG_PROFILE.baselineCapabilities,
    TEMPLATE_TAG_PROFILE.capabilityCeiling,
    declaredCapabilities,
  );

export { effectiveGrant };
