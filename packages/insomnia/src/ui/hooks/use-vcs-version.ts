import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { ChangeBufferEvent, database } from '../../common/database';
import { BaseModel } from '../../models';
import {
  selectActiveApiSpec,
  selectActiveRequest,
  selectActiveWorkspaceMeta,
} from '../redux/selectors';

// We use this hook to determine if the active request has been updated from the system (not the user typing)
// For example, by pulling a new version from the remote, switching branches, etc.
export function useActiveRequestSyncVCSVersion() {
  const [version, setVersion] = useState(0);
  const activeRequest = useSelector(selectActiveRequest);

  useEffect(() => {
    const isRequestUpdatedFromSync = (changes: ChangeBufferEvent<BaseModel>[]) => changes.find(([, doc, fromSync]) => activeRequest?._id === doc._id && fromSync);
    database.onChange(changes => isRequestUpdatedFromSync(changes) && setVersion(v => v + 1));
  }, [activeRequest?._id]);

  return version;
}

// We use this hook to determine if the active active api-spec has been updated from the system (not the user typing)
// For example, by pulling a new version from the remote, switching branches, etc.
export function useActiveApiSpecSyncVCSVersion() {
  const [version, setVersion] = useState(0);
  const activeApiSpec = useSelector(selectActiveApiSpec);

  useEffect(() => {
    const isRequestUpdatedFromSync = (changes: ChangeBufferEvent<BaseModel>[]) => changes.find(([, doc, fromSync]) => activeApiSpec?._id === doc._id && fromSync);
    database.onChange(changes => isRequestUpdatedFromSync(changes) && setVersion(v => v + 1));
  }, [activeApiSpec?._id]);

  return version;
}

// We use this hook to determine if the active workspace has been updated from the Git VCS
// For example, by pulling a new version from the remote, switching branches, etc.
export function useGitVCSVersion() {
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);

  return ((activeWorkspaceMeta?.cachedGitLastCommitTime + '') + activeWorkspaceMeta?.cachedGitRepositoryBranch) + '';
}
