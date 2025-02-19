import { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useParams } from 'react-router-dom';

import { type ChangeBufferEvent, database } from '../../common/database';
import type { BaseModel } from '../../models';
import type { WorkspaceLoaderData } from '../routes/workspace';
// We use this hook to determine if the active request has been updated from the system (not the user typing)
// For example, by pulling a new version from the remote, switching branches, etc.
export function useActiveRequestSyncVCSVersion() {
  const [version, setVersion] = useState(0);
  const { requestId } = useParams() as { requestId: string };

  useEffect(() => {
    const isRequestUpdatedFromSync = (changes: ChangeBufferEvent<BaseModel>[]) => changes.find(([, doc, fromSync]) => requestId === doc._id && fromSync);
    database.onChange(changes => isRequestUpdatedFromSync(changes) && setVersion(v => v + 1));
  }, [requestId]);

  return version;
}

// We use this hook to determine if the active active api-spec has been updated from the system (not the user typing)
// For example, by pulling a new version from the remote, switching branches, etc.
export function useActiveApiSpecSyncVCSVersion() {
  const [version, setVersion] = useState(0);
  const {
    activeApiSpec,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  useEffect(() => {
    const isRequestUpdatedFromSync = (changes: ChangeBufferEvent<BaseModel>[]) => changes.find(([, doc, fromSync]) => activeApiSpec?._id === doc._id && fromSync);
    database.onChange(changes => isRequestUpdatedFromSync(changes) && setVersion(v => v + 1));
  }, [activeApiSpec?._id]);

  return version;
}

// We use this hook to determine if the active workspace has been updated from the Git VCS
// For example, by pulling a new version from the remote, switching branches, etc.
export function useGitVCSVersion() {
  const {
    gitRepository,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  return ((gitRepository?.cachedGitLastCommitTime + '') + gitRepository?.cachedGitRepositoryBranch) + '';
}
