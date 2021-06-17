
import * as models from '../../models';
import { database } from '../../common/database';
import { VCS } from '../../sync/vcs/vcs';
import { useCallback, useEffect } from 'react';
import { isLoggedIn } from '../../account/session';
import { Space } from '../../models/space';
import { useSafeState } from './use-safe-state';

export const useRemoteSpaces = (vcs?: VCS) => {
  const [loading, setLoading] = useSafeState(false);

  const refresh = useCallback(async () => {
    if (vcs && isLoggedIn()) {
      setLoading(true);

      const teams = await vcs.teams();
      const spaces = await Promise.all(teams.map(team => models.initModel<Space>(
        models.space.type,
        {
          _id: `${models.space.prefix}_${team.id}`,
          remoteId: team.id,
          name: team.name,
        },
      )));
      await database.batchModifyDocs({ upsert: spaces });

      setLoading(false);
    }
  }, [vcs, setLoading]);

  // If the refresh callback changes, refresh
  useEffect(() => {
    (async () => { await refresh(); })();
  }, [refresh]);

  return { loading, refresh };
};
