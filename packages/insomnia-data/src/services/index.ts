// Keep the Services type tied to the node implementation without creating a runtime import cycle.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../../node-src/types.d.ts" />

type Services = ServicesNodeImpl;
export type { Services };

let servicesImplementation: Services | null = null;

export function initServices(impl: Services) {
  if (servicesImplementation) {
    throw new Error('Services have already been initialized.');
  }
  servicesImplementation = impl;
}

// Keep service and method destructuring working before initServices() runs.
export const services: Services = new Proxy({} as Services, {
  get(_target, serviceName) {
    if (typeof serviceName === 'symbol') {
      return;
    }

    return new Proxy({} as Services[keyof Services], {
      get(_target, methodName) {
        if (typeof methodName === 'symbol') {
          return;
        }

        // Resolve the real implementation at call time so pre-init destructuring stays safe.
        return (...args: unknown[]) => {
          if (!servicesImplementation) {
            throw new Error('Service not initialized. Call initServices() first.');
          }

          const service = servicesImplementation[serviceName as keyof Services] as Record<PropertyKey, unknown>;
          const method = service[methodName];

          if (typeof method !== 'function') {
            throw new TypeError(`Service member "${String(serviceName)}.${String(methodName)}" is not callable.`);
          }

          // Call with the real service object as `this` in case an implementation relies on it.
          return Reflect.apply(method, service, args);
        };
      },
    });
  },
});
