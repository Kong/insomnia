import { Dispatch } from 'redux';
import { RequireExactlyOne } from 'type-fest';

import { SegmentEvent, trackEvent, trackSegmentEvent } from '../../../common/analytics';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, GlobalActivity, isCollectionActivity, isDesignActivity } from '../../../common/constants';
import { database } from '../../../common/database';
import * as models from '../../../models';
import { isCollection, isDesign, Workspace, WorkspaceScope } from '../../../models/workspace';
import { showPrompt } from '../../components/modals';
import { selectActiveActivity, selectActiveProject, selectAllWorkspaces } from '../selectors';
import { RootState } from '.';
import { setActiveActivity, setActiveProject, setActiveWorkspace } from './global';

type OnWorkspaceCreateCallback = (arg0: Workspace) => Promise<void> | void;

const createWorkspaceAndChildren = async (patch: Partial<Workspace>) => {
  const flushId = await database.bufferChanges();

  const workspace = await models.workspace.create(patch);
  await models.workspace.ensureChildren(workspace);

  await database.flushChanges(flushId);
  return workspace;
};

const actuallyCreate = (patch: Partial<Workspace>, onCreate?: OnWorkspaceCreateCallback) => {
  return async dispatch => {
    const workspace = await createWorkspaceAndChildren(patch);

    if (onCreate) {
      await onCreate(workspace);
    }

    trackEvent('Workspace', 'Create');
    await dispatch(activateWorkspace({ workspace }));
  };
};

export const createWorkspace = ({ scope, onCreate }: {
  scope: WorkspaceScope;
  onCreate?: OnWorkspaceCreateCallback;
}) => {
  return (dispatch, getState) => {
    const activeProject = selectActiveProject(getState());

    const design = isDesign({
      scope,
    });
    const title = design ? 'Design Document' : 'Request Collection';
    const defaultValue = design ? 'my-spec.yaml' : 'My Collection';
    const segmentEvent = design ? SegmentEvent.documentCreate : SegmentEvent.collectionCreate;
    showPrompt({
      title: `Create New ${title}`,
      submitName: 'Create',
      placeholder: defaultValue,
      defaultValue,
      selectText: true,
      onComplete: async name => {
        await dispatch(
          actuallyCreate(
            {
              name,
              scope,
              parentId: activeProject._id,
            },
            onCreate,
          ),
        );
        trackSegmentEvent(segmentEvent);
      },
    });
  };
};

export const activateWorkspace = ({ workspace, workspaceId }: RequireExactlyOne<{workspace: Workspace, workspaceId: string}>) => {
  return async (dispatch: Dispatch, getState: () => RootState) => {
    // If we have no workspace but we do have an id, search for it
    if (!workspace && workspaceId) {
      workspace = selectAllWorkspaces(getState()).find(({ _id }) => _id === workspaceId);
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
    } else if (isDesign(workspace) && isDesignActivity(activeActivity)) {
      // we are in a design document, and our active activity is a design activity
      return;
    } else {
      const { activeActivity: cachedActivity } = await models.workspaceMeta.getOrCreateByParentId(workspace._id);
      const nextActivity = cachedActivity as GlobalActivity ||  (isDesign(workspace) ? ACTIVITY_SPEC : ACTIVITY_DEBUG);
      dispatch(setActiveActivity(nextActivity));
    }

    // TODO: dispatch one action to activate the project, workspace and activity in one go to avoid jumps in the UI
  };
};
