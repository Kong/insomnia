import React, { createContext, type FC, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useParams, useRevalidator, useRouteLoaderData } from 'react-router';
import * as reactUse from 'react-use';

import { useRootLoaderData } from '~/root';
import { useClearVaultKeyFetcher } from '~/routes/auth.clear-vault-key';
import type { ProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId._index';
import { useInsomniaSyncDataActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.sync-data';
import { useStorageRulesActionFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { useOrganizationSyncProjectsActionFetcher } from '~/routes/organization.$organizationId.sync-projects';
import { useOrganizationSyncActionFetcher } from '~/routes/organization.sync';

import { CDN_INVALIDATION_TTL } from '../../../common/constants';
import type { Organization } from '../../../models/organization';
import type { WorkspaceLoaderData } from '../../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { VCSInstance } from '../../../sync/vcs/insomnia-sync';
import { insomniaFetch } from '../../../ui/insomniaFetch';
import { avatarImageCache } from '../../hooks/image-cache';

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
  const projectData = useRouteLoaderData(
    'routes/organization.$organizationId.project.$projectId._index',
  ) as ProjectLoaderData;
  const workspaceData = useRouteLoaderData(
    'routes/organization.$organizationId.project.$projectId.workspace.$workspaceId',
  ) as WorkspaceLoaderData | null;
  const remoteId = projectData?.activeProject?.remoteId || workspaceData?.activeProject.remoteId;

  const [presence, setPresence] = useState<UserPresence[]>([]);
  const syncOrganizationsFetcher = useOrganizationSyncActionFetcher();
  const syncStorageRuleFetcher = useStorageRulesActionFetcher();
  const syncProjectsFetcher = useOrganizationSyncProjectsActionFetcher();
  const syncDataFetcher = useInsomniaSyncDataActionFetcher();
  const clearVaultKeyFetcher = useClearVaultKeyFetcher();

  const latestProjectId = reactUse.useLatest(projectId);
  const latestWorkspaceId = reactUse.useLatest(workspaceId);
  const latestRemoteId = reactUse.useLatest(remoteId);

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
              syncOrganizationsFetcher.submit();
            } else if (event.type === 'StorageRuleChanged' && event.team && event.team.includes('org_')) {
              syncStorageRuleFetcher.submit({
                organizationId: event.team,
              });
            } else if (event.type === 'TeamProjectChanged' && event.team === organizationId) {
              syncProjectsFetcher.submit({
                organizationId,
              });
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
              clearVaultKeyFetcher.submit({
                organizations: organizations?.map(org => org.id) || [],
                sessionId: event.sessionId,
              });
            } else if (
              (event.type === 'FileChanged' || event.type === 'BranchDeleted') &&
              event.team === organizationId &&
              latestRemoteId.current &&
              event.project === latestRemoteId.current
            ) {
              // If the file changed is the current workspace, we need to sync it
              if (isSameWorkspaceWithRemote(latestWorkspaceId.current, event.file)) {
                syncDataFetcher.submit({
                  organizationId: organizationId,
                  projectId: latestProjectId.current,
                  workspaceId: latestWorkspaceId.current,
                });
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
    clearVaultKeyFetcher,
    clearVaultKeyFetcher.submit,
    latestProjectId,
    latestRemoteId,
    latestWorkspaceId,
    organizationId,
    revalidate,
    syncDataFetcher,
    syncDataFetcher.submit,
    syncOrganizationsFetcher,
    syncOrganizationsFetcher.submit,
    syncProjectsFetcher,
    syncProjectsFetcher.submit,
    syncStorageRuleFetcher,
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
