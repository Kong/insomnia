import { href } from 'react-router';

import { database } from '~/common/database';
import type { UnitTest } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import * as models from '~/models';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.$testId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { testId } = params;
  const data = (await request.json()) as Partial<UnitTest>;

  const unitTest = await database.findOne<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  await services.unitTest.update(unitTest, data);

  return null;
}

export const useTestUpdateActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
      testId,
      data,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
      testId: string;
      data: Partial<UnitTest>;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test/:testId/update',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
          testId,
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
