import { type ActionFunctionArgs } from 'react-router';

import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ params }: ActionFunctionArgs) {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const caCertificate = await models.caCertificate.findByParentId(workspaceId);
  invariant(caCertificate, 'CA Certificate not found');
  await models.caCertificate.removeWhere(workspaceId);
  return null;
}
