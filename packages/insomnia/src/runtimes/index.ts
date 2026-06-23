import type { RuntimeCapabilities } from './types';

let runtime: RuntimeCapabilities | null = null;

export function initRuntime(impl: RuntimeCapabilities) {
  if (runtime) {
    throw new Error('Runtime has already been initialized.');
  }
  runtime = impl;
}

export function getRuntime(): RuntimeCapabilities {
  if (!runtime) {
    throw new Error('Runtime not initialized. Call initRuntime() first.');
  }
  return runtime;
}

export type { NetworkRuntime, RuntimeCapabilities } from './types';
