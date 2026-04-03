import { type Services } from '../../node-src/types';

export type { Services };

let initialized = false;
export function initServices(impl: Services) {
  if (initialized) {
    throw new Error('Services have already been initialized.');
  }
  services = impl;
  initialized = true;
}

export let services: Services = new Proxy({} as Services, {
  get(_target) {
    throw new Error('Service not initialized. Call initServices() first.');
  },
});
