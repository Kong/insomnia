import { href, redirect } from 'react-router';

import * as models from '~/models';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.delete';

export async function clientAction({ params }: Route.ClientActionArgs) {
  const { organizationId, workspaceId, projectId, testSuiteId } = params;

  const unitTestSuite = await models.unitTestSuite.getById(testSuiteId);

  invariant(unitTestSuite, 'Test Suite not found');

  await models.unitTestSuite.remove(unitTestSuite);

  window.main.trackSegmentEvent({ event: SegmentEvent.testSuiteDelete });

  return redirect(
    href(`/organization/:organizationId/project/:projectId/workspace/:workspaceId/test`, {
      organizationId,
      projectId,
      workspaceId,
    }),
  );
}

export const useTestSuiteDeleteActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/delete',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
        },
      );

      return submit(
        {},
        {
          action: url,
          method: 'POST',
        },
      );
    },
  clientAction,
);
