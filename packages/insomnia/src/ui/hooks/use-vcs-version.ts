import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import { type ChangeBufferEvent } from '../../common/database';
import type { BaseModel } from '../../models';
import { useProjectIndexLoaderData } from '../../routes/organization.$organizationId.project.$projectId._index';
import { useWorkspaceLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
// We use this hook to determine if the active request has been updated from the system (not the user typing)
// For example, by pulling a new version from the remote, switching branches, etc.
export function useActiveRequestSyncVCSVersion() {
  const [version, setVersion] = useState(0);
  const { requestId } = useParams() as { requestId: string };

  useEffect(() => {
    const isRequestUpdatedFromSync = (changes: ChangeBufferEvent<BaseModel>[]) =>
      changes.find(([, doc, fromSync]) => requestId === doc._id && fromSync);
    const unsubscribe = window.main.on('db.changes', async (_, changes) => {
      if (isRequestUpdatedFromSync(changes)) {
        setVersion(v => v + 1);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [requestId]);

  return version;
}

// We use this hook to determine if the active active api-spec has been updated from the system (not the user typing)
// For example, by pulling a new version from the remote, switching branches, etc.
export function useActiveApiSpecSyncVCSVersion() {
  const [version, setVersion] = useState(0);
  const workspaceData = useWorkspaceLoaderData();

  useEffect(() => {
    const isRequestUpdatedFromSync = (changes: ChangeBufferEvent<BaseModel>[]) =>
      changes.find(([, doc, fromSync]) => workspaceData?.activeApiSpec?._id === doc._id && fromSync);
    const unsubscribe = window.main.on('db.changes', async (_, changes) => {
      if (isRequestUpdatedFromSync(changes)) {
        setVersion(v => v + 1);
      }
    });
    return () => {
      unsubscribe();
    };
  }, [workspaceData?.activeApiSpec?._id]);

  return version;
}

// We use this hook to determine if the active workspace has been updated from the Git VCS
// For example, by pulling a new version from the remote, switching branches, etc.
export function useGitVCSVersion() {
  const workspaceData = useWorkspaceLoaderData();
  const projectData = useProjectIndexLoaderData();
  const gitRepository = workspaceData?.gitRepository || projectData?.activeProjectGitRepository;

  return `${gitRepository?.cachedGitLastCommitTime}:${gitRepository?.cachedGitRepositoryBranch}`;
}
