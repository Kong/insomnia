import { type Services } from '../../node-src/types';

export type { Services };

export function initServices(impl: Services) {
  services = impl;
}

export let services: Services = new Proxy({} as Services, {
  get(_target) {
    throw new Error('Service not initialized. Call initServices() first.');
  },
});
