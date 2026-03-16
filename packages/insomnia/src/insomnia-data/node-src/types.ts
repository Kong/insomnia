// Keep the Services type tied to the real implementation without introducing a runtime import.
// `import type` from `./services` still gets followed by the bundler in this setup and recreates
// the circular dependency, so we use a type query here instead.
// TODO: Long term, once `src/models/index.ts` is removed from this dependency path and `insomnia-data`
// no longer gets pulled back in through the legacy models barrel, this can go back to a normal
// `import type`-based alias and the lint suppression below can be dropped.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
export type Services = typeof import('./services').servicesNodeImpl;
