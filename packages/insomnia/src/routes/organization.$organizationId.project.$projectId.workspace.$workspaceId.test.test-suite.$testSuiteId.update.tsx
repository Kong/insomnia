import { href, useFetcher } from 'react-router';

import { database } from '~/common/database';
import * as models from '~/models';
import type { UnitTestSuite } from '~/models/unit-test-suite';
import { invariant } from '~/utils/invariant';

import type { Route } from './+types/organization.$organizationId.project.$projectId.workspace.$workspaceId.test.test-suite.$testSuiteId.update';

export async function clientAction({ request, params }: Route.ClientActionArgs) {
  const { testSuiteId } = params;

  const data = (await request.json()) as Partial<UnitTestSuite>;

  const unitTestSuite = await database.getWhere<UnitTestSuite>(models.unitTestSuite.type, {
    _id: testSuiteId,
  });

  invariant(unitTestSuite, 'Test Suite not found');

  await models.unitTestSuite.update(unitTestSuite, data);

  return null;
}

export function useTestSuiteUpdateActionFetcher(args?: Parameters<typeof useFetcher>[0]) {
  const fetcher = useFetcher<typeof clientAction>(args);

  function submit({
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
  }) {
    const url = href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/test/test-suite/:testSuiteId/update', {
      organizationId,
      projectId,
      workspaceId,
      testSuiteId,
    });

    return fetcher.submit(JSON.stringify(data), {
      action: url,
      method: 'POST',
      encType: 'application/json',
    });
  }

  return {
    ...fetcher,
    submit,
  };
}
