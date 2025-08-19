import { useCallback } from 'react';
import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import type { UnitTest } from '~/models/unit-test';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.$testId.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { testId } = params;

  const unitTest = await database.getWhere<UnitTest>(models.unitTest.type, {
    _id: testId,
  });
  invariant(unitTest, 'Test not found');

  await models.unitTest.remove(unitTest);
  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestDelete });

  return null;
}

export function useTestDeleteActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const { submit: fetcherSubmit, ...fetcherRest } = useFetcher<typeof clientAction>(args);

  const submit = useCallback(
    ({
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
      testId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
      testId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test/:testId/delete',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
          testId,
        },
      );

      return fetcherSubmit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
    [fetcherSubmit],
  );

  return {
    ...fetcherRest,
    submit,
  };
}
