import { type VendoredLib } from './sandbox-vendored-lib';

/**
 * The authoritative "which npm libs are vetted for the sandbox" list (M3). Side-effect-free (unlike
 * `generate-sandbox-vendored.ts`, which runs bundling as a side effect of being executed directly) so
 * `check-sandbox-vendor-guardrail.ts` and `upgrade-sandbox-vendored.ts` can import just this list
 * without triggering a full regeneration.
 */
export const VENDORED_LIBS: VendoredLib[] = [
  { name: 'uuid', entry: "module.exports = require('uuid');" },
  { name: 'ajv', entry: "module.exports = require('ajv').default || require('ajv');" },
  // Also consumed outside the template-tag sandbox: quickjs-script-engine.ts binds this bundle's
  // `.expect` as `insomnia.expect`, so pm.test()/insomnia.test() assertions match the hidden-window
  // path byte-for-byte (same library, same error messages) instead of a hand-rolled reimplementation.
  { name: 'chai', entry: "module.exports = require('chai');" },
];
