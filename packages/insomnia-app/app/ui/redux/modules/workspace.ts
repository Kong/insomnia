import type { Workspace, WorkspaceScope } from '../../../models/workspace';
import * as models from '../../../models';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../../common/constants';
import { trackEvent, trackSegmentEvent } from '../../../common/analytics';
import { isDesign } from '../../../models/helpers/is-model';
import { showPrompt } from '../../components/modals';
import { setActiveActivity, setActiveWorkspace } from './global';
import { selectActiveSpace } from '../selectors';

type OnWorkspaceCreateCallback = (arg0: Workspace) => Promise<void> | void;

const actuallyCreate = (patch: Partial<Workspace>, onCreate?: OnWorkspaceCreateCallback) => {
  return async dispatch => {
    const workspace = await models.workspace.create(patch);

    if (onCreate) {
      await onCreate(workspace);
    }

    trackEvent('Workspace', 'Create');
    dispatch(setActiveWorkspace(workspace._id));
    dispatch(setActiveActivity(isDesign(workspace) ? ACTIVITY_SPEC : ACTIVITY_DEBUG));
  };
};

export const createWorkspace = ({ scope, onCreate }: {
  scope: WorkspaceScope;
  onCreate?: OnWorkspaceCreateCallback;
}) => {
  return (dispatch, getState) => {
    const activeSpace = selectActiveSpace(getState());
    const parentId = activeSpace?._id || null;

    const design = isDesign({
      scope,
    });
    const title = design ? 'Design Document' : 'Request Collection';
    const defaultValue = design ? 'my-spec.yaml' : 'My Collection';
    const segmentEvent = design ? 'Document Created' : 'Collection Created';
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
              // @ts-expect-error TSCONVERSION the common parentId isn't typed correctly
              parentId,
            },
            onCreate,
          ),
        );
        trackSegmentEvent(segmentEvent);
      },
    });
  };
};
