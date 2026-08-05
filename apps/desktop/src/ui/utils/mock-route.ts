import type { MockRoute } from 'insomnia-data';

export const isSameMockRouteTarget = (
  a: { name: string; method: string },
  b: { name: string; method: string },
): boolean => a.name === b.name && a.method.toUpperCase() === b.method.toUpperCase();

/**
 * Returns an existing mock route that conflicts with the method+path pair or undefined
 */
export const findConflictingMockRoute = ({
  existingRoutes,
  name,
  method,
  excludeId,
}: {
  existingRoutes: MockRoute[];
  name: string;
  method: string;
  excludeId?: string;
}): MockRoute | undefined =>
  existingRoutes
    .filter(route => route._id !== excludeId)
    .find(route => isSameMockRouteTarget(route, { name, method }));
