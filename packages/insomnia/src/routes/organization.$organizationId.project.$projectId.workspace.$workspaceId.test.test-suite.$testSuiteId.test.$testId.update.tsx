import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import type { UnitTest } from '~/models/unit-test';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.$testId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { testId } = params;
  const data = (await request.json()) as Partial<UnitTest>;

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  await models.unitTest.update(unitTest, data);

  return null;
}

export function useTestUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
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

      return fetcherSubmit(JSON.stringify(data), {
        action: url,
        method: 'POST',
        encType: 'application/json',
      });
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
