import { useCallback, useMemo, useEffect, useReducer, Reducer } from 'react';
import { useSelector } from 'react-redux';
import { isLoggedIn } from '../../account/session';
import { Project } from '../../sync/types';
import { VCS } from '../../sync/vcs/vcs';
import { pullProject } from '../../sync/vcs/pull-project';
import { showAlert } from '../components/modals';
import { selectActiveSpace, selectAllWorkspaces } from '../redux/selectors';
import { useSafeReducerDispatch } from './use-safe-reducer-dispatch';

interface State {
  loading: boolean;
  localProjects: Project[];
  remoteProjects: Project[];
  pullingProjects: Record<string, boolean>;
}

const initialState: State = {
  loading: false,
  localProjects: [],
  remoteProjects: [],
  pullingProjects: {},
};

type Action =
  | { type: 'loadProjects' }
  | { type: 'saveProjects', local: State['localProjects'], remote: State['remoteProjects']}
  | { type: 'startPullingProject', projectId: string }
  | { type: 'stopPullingProject', projectId: string }

const reducer: Reducer<State, Action> = (prevState, action) => {
  switch (action.type) {
    case 'loadProjects':
      return { ...prevState, loading: true };
    case 'saveProjects':
      return { ...prevState, localProjects: action.local, remoteProjects: action.remote, loading: false };
    case 'startPullingProject':
      return { ...prevState, pullingProjects: { ...prevState.pullingProjects, [action.projectId]: true } };
    case 'stopPullingProject':
      return { ...prevState, pullingProjects: { ...prevState.pullingProjects, [action.projectId]: false } };
    default:
      return prevState;
  }
};

export const useRemoteWorkspaces = (vcs?: VCS) => {
  // Fetch from redux
  const workspaces = useSelector(selectAllWorkspaces);
  const activeSpace = useSelector(selectActiveSpace);
  const spaceRemoteId = activeSpace?.remoteId || undefined;

  // Local state
  const [{ loading, localProjects, remoteProjects, pullingProjects }, _dispatch] = useReducer(reducer, initialState);
  const dispatch = useSafeReducerDispatch(_dispatch);

  // Refresh remote spaces
  const refresh = useCallback(async () => {
    if (!vcs || !isLoggedIn()) {
      return;
    }

    dispatch({ type: 'loadProjects' });
    const remote = await vcs.remoteProjects(spaceRemoteId);
    const local = await vcs.localProjects();
    dispatch({ type: 'saveProjects', local, remote });
  }, [dispatch, spaceRemoteId, vcs]);

  // Find remote spaces that haven't been pulled
  const missingProjects = useMemo(() => remoteProjects.filter(({ id, rootDocumentId }) => {
    const localProjectExists = localProjects.find(p => p.id === id);
    const workspaceExists = workspaces.find(w => w._id === rootDocumentId);
    // Mark as missing if:
    //   - the project doesn't yet exists locally
    //   - the project exists locally but somehow the workspace doesn't anymore
    return !(workspaceExists && localProjectExists);
  }), [localProjects, remoteProjects, workspaces]);

  // Pull a remote space
  const pull = useCallback(async (project: Project) => {
    if (!vcs) {
      throw new Error('VCS is not defined');
    }

    dispatch({ type: 'startPullingProject', projectId: project.id });

    try {
      // Clone old VCS so we don't mess anything up while working on other projects
      const newVCS = vcs.newInstance();
      // Remove all projects for workspace first
      await newVCS.removeProjectsForRoot(project.rootDocumentId);

      await pullProject({ vcs: newVCS, project, space: activeSpace });

      await refresh();
    } catch (err) {
      showAlert({
        title: 'Pull Error',
        message: `Failed to pull workspace. ${err.message}`,
      });
    } finally {
      dispatch({ type: 'stopPullingProject', projectId: project.id });
    }
  }, [vcs, refresh, activeSpace, dispatch]);

  // If the refresh callback changes, refresh
  useEffect(() => {
    (async () => { await refresh(); })();
  }, [refresh]);

  return {
    loading,
    missingProjects,
    pullingProjects,
    refresh,
    pull,
  };
};
