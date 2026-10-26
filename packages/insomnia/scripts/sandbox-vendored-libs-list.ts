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
];
