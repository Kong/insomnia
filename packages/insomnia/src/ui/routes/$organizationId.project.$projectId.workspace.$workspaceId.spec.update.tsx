import { type ActionFunctionArgs } from 'react-router';

import { database } from '../../common/database';
import * as models from '../../models';
import { invariant } from '../../utils/invariant';

export async function action({ request, params }: ActionFunctionArgs) {
  const { workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const formData = await request.formData();
  const contents = formData.get('contents');
  const fromSync = Boolean(formData.get('fromSync'));

  invariant(typeof contents === 'string', 'Contents is required');

  const apiSpec = await models.apiSpec.getByParentId(workspaceId);

  invariant(apiSpec, 'API Spec not found');
  await database.update(
    {
      ...apiSpec,
      modified: Date.now(),
      created: fromSync ? Date.now() : apiSpec.created,
      contents,
    },
    fromSync,
  );

  return null;
}
