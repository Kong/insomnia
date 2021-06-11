
import * as models from '../../models';
import { database } from '../../common/database';
import VCS from '../../sync/vcs';
import { useCallback, useEffect, useState } from 'react';
import { isLoggedIn } from '../../account/session';
import { Space } from '../../models/space';
import { selectActiveSpace } from '../redux/selectors';
import { useSelector } from 'react-redux';
import { isNotNullOrUndefined } from '../../common/misc';

export const useActiveSpace = () => {
  const activeSpace = useSelector(selectActiveSpace);
  const spaceRemoteId = activeSpace?.remoteId || undefined;
  const isRemoteSpace = isNotNullOrUndefined(spaceRemoteId);
  return { activeSpace, isRemoteSpace };
};

export const useRemoteSpaces = (vcs?: VCS) => {
  const [loading, setLoading] = useState(false);

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
  }, [vcs]);

  // If the refresh callback changes, refresh
  useEffect(() => {
    (async () => { await refresh(); })();
  }, [refresh]);

  return { loading, refresh };
};
