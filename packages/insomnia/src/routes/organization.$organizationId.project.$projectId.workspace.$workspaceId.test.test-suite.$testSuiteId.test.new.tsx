import { href } from 'react-router';

import { services } from '~/insomnia-data';
import { SegmentEvent } from '~/ui/analytics';
import { invariant } from '~/utils/invariant';
import { createFetcherSubmitHook } from '~/utils/router';

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

  window.main.trackSegmentEvent({ event: SegmentEvent.unitTestCreate });

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
