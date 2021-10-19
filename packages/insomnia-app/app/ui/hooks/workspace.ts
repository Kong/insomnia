import { Reducer, useCallback, useMemo, useReducer } from 'react';
import { useSelector } from 'react-redux';
import { useAsync } from 'react-use';

import { isRemoteProject } from '../../models/project';
import { BackendProject } from '../../sync/types';
import { BackendProjectWithTeam } from '../../sync/vcs/normalize-backend-project-team';
import { pullBackendProject } from '../../sync/vcs/pull-backend-project';
import { VCS } from '../../sync/vcs/vcs';
import { showAlert } from '../components/modals';
import { selectActiveProject, selectAllWorkspaces, selectIsLoggedIn, selectRemoteProjects, selectSettings } from '../redux/selectors';
import { useSafeReducerDispatch } from './use-safe-reducer-dispatch';

interface State {
  loading: boolean;
  localBackendProjects: BackendProject[];
  remoteBackendProjects: BackendProjectWithTeam[];
  pullingBackendProjects: Record<string, boolean>;
}

const initialState: State = {
  loading: false,
  localBackendProjects: [],
  remoteBackendProjects: [],
  pullingBackendProjects: {},
};

type Action =
  | { type: 'loadBackendProjects' }
  | { type: 'saveBackendProjects'; local: State['localBackendProjects']; remote: State['remoteBackendProjects']}
  | { type: 'startPullingBackendProject'; backendProjectId: string }
  | { type: 'stopPullingBackendProject'; backendProjectId: string };

const reducer: Reducer<State, Action> = (prevState, action) => {
  switch (action.type) {
    case 'loadBackendProjects':
      return { ...prevState, loading: true };
    case 'saveBackendProjects':
      return { ...prevState, localBackendProjects: action.local, remoteBackendProjects: action.remote, loading: false };
    case 'startPullingBackendProject':
      return { ...prevState, pullingBackendProjects: { ...prevState.pullingBackendProjects, [action.backendProjectId]: true } };
    case 'stopPullingBackendProject':
      return { ...prevState, pullingBackendProjects: { ...prevState.pullingBackendProjects, [action.backendProjectId]: false } };
    default:
      return prevState;
  }
};

export const useRemoteWorkspaces = (vcs?: VCS) => {
  // Fetch from redux
  const workspaces = useSelector(selectAllWorkspaces);
  const activeProject = useSelector(selectActiveProject);
  const remoteProjects = useSelector(selectRemoteProjects);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { incognitoMode } = useSelector(selectSettings);

  // Local state
  const [{ loading, localBackendProjects, remoteBackendProjects, pullingBackendProjects }, _dispatch] = useReducer(reducer, initialState);
  const dispatch = useSafeReducerDispatch(_dispatch);

  // Refresh remote backend project
  const refresh = useCallback(async () => {
    if (!vcs || !isLoggedIn || !isRemoteProject(activeProject)) {
      return;
    }

    dispatch({ type: 'loadBackendProjects' });
    const remoteBackendProjects = await vcs.remoteBackendProjects(activeProject.remoteId);
    const localBackendProjects = await vcs.localBackendProjects();
    dispatch({ type: 'saveBackendProjects', local: localBackendProjects, remote: remoteBackendProjects });
  }, [vcs, isLoggedIn, activeProject, dispatch]);

  // Find remote backend project that haven't been pulled
  const missingBackendProjects = useMemo(() => remoteBackendProjects.filter(({ id, rootDocumentId }) => {
    const localBackendProjectExists = localBackendProjects.find(p => p.id === id);
    const workspaceExists = workspaces.find(w => w._id === rootDocumentId);
    // Mark as missing if:
    //   - the backend project doesn't yet exists locally
    //   - the backend project exists locally but somehow the workspace doesn't anymore
    return !(workspaceExists && localBackendProjectExists);
  }), [localBackendProjects, remoteBackendProjects, workspaces]);

  // Pull a remote backend project
  const pull = useCallback(async (backendProject: BackendProjectWithTeam) => {
    if (!vcs) {
      throw new Error('VCS is not defined');
    }

    dispatch({ type: 'startPullingBackendProject', backendProjectId: backendProject.id });

    try {
      // Clone old VCS so we don't mess anything up while working on other backend projects
      const newVCS = vcs.newInstance();
      // Remove all backend projects for workspace first
      await newVCS.removeBackendProjectsForRoot(backendProject.rootDocumentId);

      await pullBackendProject({ vcs: newVCS, backendProject, remoteProjects });

      await refresh();
    } catch (err) {
      showAlert({
        title: 'Pull Error',
        message: `Failed to pull workspace. ${err.message}`,
      });
    } finally {
      dispatch({ type: 'stopPullingBackendProject', backendProjectId: backendProject.id });
    }
  }, [vcs, refresh, remoteProjects, dispatch]);

  // If the refresh callback changes, refresh
  useAsync(async () => {
    if (!incognitoMode) {
      await refresh();
    }
  }, [refresh, incognitoMode]);

  return {
    loading,
    missingBackendProjects,
    pullingBackendProjects,
    refresh,
    pull,
  };
};
