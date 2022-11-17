import { Dispatch } from 'redux';
import type { RequireExactlyOne } from 'type-fest';

import { ACTIVITY_DEBUG, ACTIVITY_SPEC, GlobalActivity, isCollectionActivity, isDesignActivity } from '../../../common/constants';
import * as models from '../../../models';
import { isCollection, isDesign, Workspace } from '../../../models/workspace';
import { selectActiveActivity, selectWorkspaces } from '../selectors';
import { RootState } from '.';
import { setActiveActivity, setActiveProject, setActiveWorkspace } from './global';

export const activateWorkspace = ({ workspace, workspaceId }: RequireExactlyOne<{workspace: Workspace; workspaceId: string}>) => {
  return async (dispatch: Dispatch, getState: () => RootState) => {
    // If we have no workspace but we do have an id, search for it
    if (!workspace && workspaceId) {
      workspace = selectWorkspaces(getState()).find(({ _id }) => _id === workspaceId);
    }

    // If we still have no workspace, exit
    if (!workspace) {
      return;
    }

    const activeActivity = selectActiveActivity(getState()) || undefined;

    // Activate the correct project
    const nextProjectId = workspace.parentId;
    dispatch(setActiveProject(nextProjectId));

    // Activate the correct workspace
    const nextWorkspaceId = workspace._id;
    dispatch(setActiveWorkspace(nextWorkspaceId));

    // Activate the correct activity
    if (isCollection(workspace) && isCollectionActivity(activeActivity)) {
      // we are in a collection, and our active activity is a collection activity
      return;
    }

    if (isDesign(workspace) && isDesignActivity(activeActivity)) {
      // we are in a design document, and our active activity is a design activity
      return;
    }

    const { activeActivity: cachedActivity } = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
    const nextActivity = cachedActivity as GlobalActivity ||  (isDesign(workspace) ? ACTIVITY_SPEC : ACTIVITY_DEBUG);
    dispatch(setActiveActivity(nextActivity));

    // TODO: dispatch one action to activate the project, workspace and activity in one go to avoid jumps in the UI
  };
};
