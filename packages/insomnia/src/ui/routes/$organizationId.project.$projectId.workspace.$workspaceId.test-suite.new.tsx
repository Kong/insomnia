import { type ActionFunctionArgs, redirect } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';

export async function action({ request, params }: ActionFunctionArgs) {
  const { organizationId, workspaceId, projectId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const formData = await request.formData();
  const name = formData.get('name');
  invariant(typeof name === 'string', 'Name is required');

  const unitTestSuite = await models.unitTestSuite.create({
    parentId: workspaceId,
    name,
  });

  window.main.trackSegmentEvent({ event: SegmentEvent.testSuiteCreate });

  return redirect(
    `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/test/test-suite/${unitTestSuite._id}`,
  );
}
