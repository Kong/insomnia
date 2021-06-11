import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { isLoggedIn } from '../../account/session';
import { Project } from '../../sync/types';
import VCS from '../../sync/vcs';
import { pullProject } from '../../sync/vcs/pull-project';
import { showAlert } from '../components/modals';
import { selectActiveSpace, selectAllWorkspaces } from '../redux/selectors';

export const useRemoteWorkspaces = (vcs?: VCS) => {
  // Fetch from redux
  const workspaces = useSelector(selectAllWorkspaces);
  const activeSpace = useSelector(selectActiveSpace);
  const spaceRemoteId = activeSpace?.remoteId || undefined;
  const spaceId = activeSpace?._id;

  // Local state
  const [loading, setLoading] = useState(false);
  const [localProjects, setLocalProjects] = useState<Project[]>([]);
  const [remoteProjects, setRemoteProjects] = useState<Project[]>([]);
  const [pullingProjects, setPullingProjects] = useState<Record<string, boolean>>({});

  // Refresh remote spaces
  const refresh = useCallback(async () => {
    if (!vcs || !isLoggedIn()) {
      return;
    }

    setLoading(true);
    const remote = await vcs.remoteProjects(spaceRemoteId);
    const local = await vcs.localProjects();
    setRemoteProjects(remote);
    setLocalProjects(local);
    setLoading(false);
  },
  [spaceRemoteId, vcs]);

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

    setPullingProjects(state => ({ ...state, [project.id]: true }));

    try {
      // Clone old VCS so we don't mess anything up while working on other projects
      const newVCS = vcs.newInstance();
      // Remove all projects for workspace first
      await newVCS.removeProjectsForRoot(project.rootDocumentId);

      await pullProject({ vcs: newVCS, project, spaceId });

      await refresh();
    } catch (err) {
      showAlert({
        title: 'Pull Error',
        message: `Failed to pull workspace. ${err.message}`,
      });
    } finally {
      setPullingProjects(state => ({ ...state, [project.id]: false }));
    }
  }, [vcs, refresh, spaceId]);

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
