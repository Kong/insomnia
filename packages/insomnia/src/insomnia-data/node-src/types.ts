// Runtime stub only.
// `src/services/index.ts` imports `../../node-src/types` as a type, and esbuild still needs
// a resolvable `.ts` module at this path. Keeping this file dependency-free prevents the
// bundler from pulling `node-src/services` into the runtime graph and recreating the cycle.
export const _servicesTypesStub = true;
