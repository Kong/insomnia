import type { MockRoute, MockServer, Response } from 'insomnia-data';
import { useCallback } from 'react';
import { useParams, useRouteLoaderData } from 'react-router';

import { useMockRouteUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.update';

export interface MockRouteLoaderData {
  mockServer: MockServer;
  mockRoute: MockRoute;
  activeResponse?: Response;
}

// Reads the mock-route route's loader data by route id so consumers (and the route itself) don't
// import the route module, which renders those consumers — importing it would close a
// route <-> component cycle. The route's `clientLoader` conforms to `MockRouteLoaderData`.
export const useMockRouteLoaderData = () =>
  useRouteLoaderData(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId',
  ) as MockRouteLoaderData | undefined;

export const useMockRoutePatcher = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { submit } = useMockRouteUpdateActionFetcher();
  return useCallback(
    (id: string, patch: Partial<MockRoute>) => {
      return submit({
        mockRouteId: id,
        organizationId,
        projectId,
        workspaceId,
        patch,
      });
    },
    [organizationId, projectId, submit, workspaceId],
  );
};
