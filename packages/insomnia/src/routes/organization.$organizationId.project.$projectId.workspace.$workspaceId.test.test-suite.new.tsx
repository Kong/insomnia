import { href, redirect } from 'react-router';

import { services } from '~/insomnia-data';
import { AnalyticsEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.new';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { organizationId, workspaceId, projectId } = params;

  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const unitTestSuite = await services.unitTestSuite.create({
    parentId: workspaceId,
    name,
  });

  window.main.trackAnalyticsEvent({ event: AnalyticsEvent.testSuiteCreate });

  return redirect(
    href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId', {
      organizationId,
      projectId,
      workspaceId,
      testSuiteId: unitTestSuite._id,
    }),
  );
}

export const useTestSuiteNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      name,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      name: string;
    }) => {
      const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/new', {
        organizationId,
        projectId,
        workspaceId,
      });

      const formData = new FormData();
      formData.append('name', name);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
