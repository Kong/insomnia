import { LoaderFunction, redirect } from 'react-router-dom';

import { getProductName } from '../../common/constants';
import * as models from '../../models';

export const loader: LoaderFunction = async () => {
  try {
    const scratchpadProject = await models.project.getById(models.project.SCRATCHPAD_PROJECT_ID);
    const scratchPad = await models.workspace.getById(models.workspace.SCRATCHPAD_WORKSPACE_ID);
    if (!scratchpadProject) {
      console.log('Initializing Scratch Pad Project');
      await models.project.create({ _id: models.project.SCRATCHPAD_PROJECT_ID, name: getProductName(), remoteId: null, parentId: models.organization.SCRATCHPAD_ORGANIZATION_ID });
    }

    if (!scratchPad) {
      console.log('Initializing Scratch Pad');
      await models.workspace.create({ _id: models.workspace.SCRATCHPAD_WORKSPACE_ID, name: 'Scratch Pad', parentId: models.project.SCRATCHPAD_PROJECT_ID, scope: 'collection' });
    }
  } catch (err) {
    console.warn('Failed to create default project. It probably already exists', err);
  }
  return redirect(`/organization/${models.organization.SCRATCHPAD_ORGANIZATION_ID}/project/${models.project.SCRATCHPAD_PROJECT_ID}/workspace/${models.workspace.SCRATCHPAD_WORKSPACE_ID}/debug`);
};
