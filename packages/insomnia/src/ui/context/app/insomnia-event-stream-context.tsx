import React, { createContext, type FC, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useFetcher, useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import { useLatest } from 'react-use';

import { CDN_INVALIDATION_TTL } from '../../../common/constants';
import type { Organization } from '../../../models/organization';
import { VCSInstance } from '../../../sync/vcs/insomnia-sync';
import { insomniaFetch } from '../../../ui/insomniaFetch';
import { avatarImageCache } from '../../hooks/image-cache';
import type { ProjectIdLoaderData } from '../../routes/$organizationId.project.$projectId';
import type { WorkspaceLoaderData } from '../../routes/$organizationId.project.$projectId.workspace.$workspaceId';
import { useRootLoaderData } from '../../routes/root';

const InsomniaEventStreamContext = createContext<{
  presence: UserPresence[];
}>({
  presence: [],
});

// This happens because the API accepts teamIds as team_xxx
function sanitizeTeamId(teamId: string) {
  return teamId.replace('proj_', '');
}

interface TeamProjectChangedEvent {
  topic: string;
  type: 'TeamProjectChanged';
  team: string;
  project: string;
}

interface FileDeletedEvent {
  topic: string;
  type: 'FileDeleted';
  team: string;
  project: string;
  file: string;
}

interface BranchDeletedEvent {
  topic: string;
  type: 'BranchDeleted';
  team: string;
  project: string;
  file: string;
  branch: string;
}

interface FileChangedEvent {
  topic: string;
  type: 'FileChanged';
  team: string;
  project: string;
  file: string;
  branch: string;
}

interface VaultKeyChangeEvent {
  type: 'VaultKeyChanged';
  topic: string;
  sessionId: string;
}

export interface UserPresence {
  acct: string;
  avatar: string;
  branch: string;
  file: string;
  firstName: string;
  lastName: string;
  project: string;
  team: string;
}

interface UserPresenceEvent extends UserPresence {
  type: 'PresentUserLeave' | 'PresentStateChanged' | 'OrganizationChanged' | 'StorageRuleChanged';
}

const isSameWorkspaceWithRemote = (workspaceId: string | undefined, remoteWorkspaceId: string | undefined) => {
  if (!workspaceId || !remoteWorkspaceId) {
    return false;
  }
  const vcs = VCSInstance();
  const currentBackendProject = vcs.getActiveBackendProject();
  if (
    currentBackendProject &&
    currentBackendProject?.id === remoteWorkspaceId &&
    currentBackendProject.rootDocumentId === workspaceId
  ) {
    return true;
  }
  return false;
};

export const InsomniaEventStreamProvider: FC<PropsWithChildren> = ({ children }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const { userSession } = useRootLoaderData();
  const projectData = useRouteLoaderData('/project/:projectId') as ProjectIdLoaderData | null;
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | null;
  const remoteId = projectData?.activeProject?.remoteId || workspaceData?.activeProject.remoteId;

  const [presence, setPresence] = useState<UserPresence[]>([]);
  const syncOrganizationsFetcher = useFetcher();
  const syncStorageRuleFetcher = useFetcher();
  const syncProjectsFetcher = useFetcher();
  const syncDataFetcher = useFetcher();
  const clearVaultKeyFetcher = useFetcher();

  const latestProjectId = useLatest(projectId);
  const latestWorkspaceId = useLatest(workspaceId);
  const latestRemoteId = useLatest(remoteId);

  // Update presence when the user switches org, projects, workspaces
  useEffect(() => {
    async function updatePresence() {
      const sessionId = userSession.id;
      if (sessionId && remoteId) {
        try {
          const response = await insomniaFetch<{
            data?: UserPresence[];
          }>({
            path: `/v1/organizations/${sanitizeTeamId(organizationId)}/collaborators`,
            method: 'POST',
            sessionId,
            data: {
              project: remoteId,
              file: workspaceId,
            },
          });

          const rows = response?.data || [];
          if (rows.length > 0) {
            setPresence(rows);
          }
        } catch (e) {
          console.log('[sse] Error parsing response', e);
        }
      }
    }

    updatePresence();
  }, [organizationId, remoteId, userSession.id, workspaceId]);

  const { revalidate } = useRevalidator();

  useEffect(() => {
    const sessionId = userSession.id;
    if (sessionId) {
      try {
        const source = new EventSource(`insomnia-event-source://v1/teams/${sanitizeTeamId(organizationId)}/streams`);

        source.addEventListener('message', e => {
          try {
            const event = JSON.parse(e.data) as
              | UserPresenceEvent
              | TeamProjectChangedEvent
              | FileDeletedEvent
              | BranchDeletedEvent
              | FileChangedEvent
              | VaultKeyChangeEvent;
            if (event.type === 'PresentUserLeave') {
              setPresence(prev =>
                prev.filter(p => {
                  const isSameUser = p.acct === event.acct;
                  const isSameProjectFile = p.file === event.file && p.project === event.project;

                  // Remove any presence events we have for the same user in this project/file
                  if (isSameUser && isSameProjectFile) {
                    return false;
                  }

                  return true;
                }),
              );
            } else if (event.type === 'PresentStateChanged') {
              setPresence(prev => {
                if (!prev.find(p => p.avatar === event.avatar)) {
                  // if this avatar is new, invalidate the cache
                  window.setTimeout(() => avatarImageCache.invalidate(event.avatar), CDN_INVALIDATION_TTL);
                }
                return [...prev.filter(p => p.acct !== event.acct), event];
              });
            } else if (event.type === 'OrganizationChanged') {
              if (event.avatar) {
                window.setTimeout(() => avatarImageCache.invalidate(event.avatar), CDN_INVALIDATION_TTL);
              }
              const submit = syncOrganizationsFetcher.submit;
              submit(
                {},
                {
                  action: '/organization/sync',
                  method: 'POST',
                },
              );
            } else if (event.type === 'StorageRuleChanged' && event.team && event.team.includes('org_')) {
              const orgId = event.team;
              const submit = syncStorageRuleFetcher.submit;
              submit(
                {},
                {
                  action: `/organization/${orgId}/storage-rules`,
                  method: 'POST',
                },
              );
            } else if (event.type === 'TeamProjectChanged' && event.team === organizationId) {
              const submit = syncProjectsFetcher.submit;
              submit(
                {},
                {
                  action: `/organization/${organizationId}/sync-projects`,
                  method: 'POST',
                },
              );
            } else if (
              event.type === 'FileDeleted' &&
              event.team === organizationId &&
              latestRemoteId.current &&
              event.project === latestRemoteId.current &&
              // we don't need to revalidate if the user is in workspace page
              !latestWorkspaceId.current
            ) {
              revalidate();
            } else if (event.type === 'VaultKeyChanged') {
              const accountId = userSession.accountId;
              const organizations = JSON.parse(
                localStorage.getItem(`${accountId}:organizations`) || '[]',
              ) as Organization[];
              const submit = clearVaultKeyFetcher.submit;
              submit(
                {
                  organizations: organizations?.map(org => org.id) || [],
                  sessionId: event.sessionId,
                },
                {
                  action: '/auth/clear-vault-key',
                  method: 'POST',
                  encType: 'application/json',
                },
              );
            } else if (
              (event.type === 'FileChanged' || event.type === 'BranchDeleted') &&
              event.team === organizationId &&
              latestRemoteId.current &&
              event.project === latestRemoteId.current
            ) {
              // If the file changed is the current workspace, we need to sync it
              if (isSameWorkspaceWithRemote(latestWorkspaceId.current, event.file)) {
                const submit = syncDataFetcher.submit;
                submit(
                  {},
                  {
                    method: 'POST',
                    action: `/organization/${organizationId}/project/${latestProjectId.current}/workspace/${latestWorkspaceId.current}/insomnia-sync/sync-data`,
                  },
                );
              } else if (event.type === 'FileChanged' && !latestWorkspaceId.current) {
                // FileChanged could be a new file has been added, we need to revalidate the workspace list
                revalidate();
              }
            }
          } catch (e) {
            console.log('[sse] Error parsing response from SSE', e);
          }
        });
        return () => {
          source.close();
        };
      } catch (e) {
        console.log('[sse] ERROR', e);
        return;
      }
    }
    return;
  }, [
    clearVaultKeyFetcher.submit,
    latestProjectId,
    latestRemoteId,
    latestWorkspaceId,
    organizationId,
    revalidate,
    syncDataFetcher.submit,
    syncOrganizationsFetcher.submit,
    syncProjectsFetcher.submit,
    syncStorageRuleFetcher.submit,
    userSession.accountId,
    userSession.id,
  ]);

  return (
    <InsomniaEventStreamContext.Provider
      value={{
        presence,
      }}
    >
      {children}
    </InsomniaEventStreamContext.Provider>
  );
};

export const useInsomniaEventStreamContext = () => useContext(InsomniaEventStreamContext);
