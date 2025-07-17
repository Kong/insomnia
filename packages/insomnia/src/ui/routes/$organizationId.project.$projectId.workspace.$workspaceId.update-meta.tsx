import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import type { WorkspaceMeta } from '../../models/workspace-meta';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const patch = (await request.json()) as Partial<WorkspaceMeta>;
  await models.workspaceMeta.updateByParentId(workspaceId, patch);
  return null;
}
