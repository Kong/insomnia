// Use this file to export services that are shared across the app. This is a workaround for circular dependencies between services and models. Services should not depend on models, but models can depend on services.
// type Services = InsomniaData.Services;
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node-src/types.d.ts" />

type Services = ServicesNodeImpl;
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
