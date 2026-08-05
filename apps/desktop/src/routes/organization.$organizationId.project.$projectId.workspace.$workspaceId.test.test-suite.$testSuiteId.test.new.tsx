import { services } from 'insomnia-data';
import { href } from 'react-router';

import { invariant } from '~/common/utils/invariant';
import { AnalyticsEvent } from '~/ui/analytics';
import { createFetcherSubmitHook } from '~/ui/utils/router';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.test.new';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { testSuiteId } = params;

  const formData = await request.formData();

  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  await services.unitTest.create({
    parentId: testSuiteId,
    code: `const response1 = await insomnia.send();
expect(response1.status).to.equal(200);`,
    name,
  });

  window.main.trackAnalyticsEvent({ event: AnalyticsEvent.unitTestCreate });

  return null;
}

export const useTestNewActionFetcher = createFetcherSubmitHook(
  submit =>
    ({
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
      name,
    }: {
      organizationId: string;
      projectId: string;
      workspaceId: string;
      testSuiteId: string;
      name: string;
    }) => {
      const url = href(
        '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/test/new',
        {
          organizationId,
          projectId,
          workspaceId,
          testSuiteId,
        },
      );

      const formData = new FormData();
      formData.append('name', name);

      return submit(formData, {
        action: url,
        method: 'POST',
      });
    },
  clientAction,
);
