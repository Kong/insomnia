import { href } from 'react-router';

import { database } from '~/common/database';
import type { UnitTestSuite } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { testSuiteId } = params;

  const data = (await request.json()) as Partial<UnitTestSuite>;

  const unitTestSuite = await database.findOne<UnitTestSuite>(models.unitTestSuite.type, {
    _id: testSuiteId,
  });

  invariant(unitTestSuite, 'Test Suite not found');

  await services.unitTestSuite.update(unitTestSuite, data);

  return null;
}

export const useTestSuiteUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
      data,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
      data: Partial<UnitTestSuite>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/update',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
        },
      );

      return submit(JSON.stringify(data), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
  clientAction,
);
