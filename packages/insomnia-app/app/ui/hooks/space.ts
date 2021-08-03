
import { useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';

import { database } from '../../common/database';
import { initializeSpaceFromTeam } from '../../sync/vcs/initialize-space-from-team';
import { VCS } from '../../sync/vcs/vcs';
import { selectIsLoggedIn } from '../redux/selectors';
import { useSafeState } from './use-safe-state';

export const useRemoteSpaces = (vcs?: VCS) => {
  const [loading, setLoading] = useSafeState(false);
  const isLoggedIn = useSelector(selectIsLoggedIn);

  const refresh = useCallback(async () => {
    if (vcs && isLoggedIn) {
      setLoading(true);

      const teams = await vcs.teams();
      const spaces = await Promise.all(teams.map(initializeSpaceFromTeam));
      await database.batchModifyDocs({ upsert: spaces });

      setLoading(false);
    }
  }, [vcs, setLoading, isLoggedIn]);

  // If the refresh callback changes, refresh
  useEffect(() => {
    (async () => { await refresh(); })();
  }, [refresh]);

  return { loading, refresh };
};
