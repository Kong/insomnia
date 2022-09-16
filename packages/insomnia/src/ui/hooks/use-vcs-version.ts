import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { database } from '../../common/database';
import { selectActiveRequest, selectActiveWorkspaceMeta } from '../redux/selectors';

// We use this hook to determine if the active request has been updated from the VCS
// For example, by pulling a new version from the remote, switching branches, etc.
export function useActiveRequestSyncVCSVersion() {
  const [version, setVersion] = useState(0);
  const activeRequest = useSelector(selectActiveRequest);

  useEffect(() => {
    database.onChange(changes => {
      for (const change of changes) {
        const [, doc, fromSync] = change;

        // Force refresh if sync changes the active request
        if (activeRequest?._id === doc._id && fromSync) {
          setVersion(v => v + 1);
        }
      }
    });
  }, [activeRequest?._id]);

  return version;
}

// We use this hook to determine if the active workspace has been updated from the Git VCS
// For example, by pulling a new version from the remote, switching branches, etc.
export function useGitVCSVersion() {
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);

  return ((activeWorkspaceMeta?.cachedGitLastCommitTime + '') + activeWorkspaceMeta?.cachedGitRepositoryBranch) + '';
}
