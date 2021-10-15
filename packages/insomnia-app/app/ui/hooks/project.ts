
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useAsync } from 'react-use';

import { database } from '../../common/database';
import { initializeProjectFromTeam } from '../../sync/vcs/initialize-model-from';
import { VCS } from '../../sync/vcs/vcs';
import { selectIsLoggedIn, selectSettings } from '../redux/selectors';
import { useSafeState } from './use-safe-state';

export const useRemoteProjects = (vcs?: VCS) => {
  const [loading, setLoading] = useSafeState(false);
  const isLoggedIn = useSelector(selectIsLoggedIn);
  const { incognitoMode } = useSelector(selectSettings);

  const refresh = useCallback(async () => {
    if (vcs && isLoggedIn) {
      setLoading(true);

      const teams = await vcs.teams();
      const projects = await Promise.all(teams.map(initializeProjectFromTeam));
      await database.batchModifyDocs({ upsert: projects });

      setLoading(false);
    }
  }, [vcs, setLoading, isLoggedIn]);

  // If the refresh callback changes, refresh
  useAsync(async () => {
    if (!incognitoMode) {
      await refresh();
    }
  }, [refresh, incognitoMode]);
  return { loading, refresh };
};
