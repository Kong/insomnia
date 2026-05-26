// Bundler-time shim: Vite resolves this to network-adapter.renderer.ts,
// inso esbuild resolves this to network-adapter.node.ts.
// This file is the TypeScript target for type-checking only.
export * from './network-adapter.renderer';
