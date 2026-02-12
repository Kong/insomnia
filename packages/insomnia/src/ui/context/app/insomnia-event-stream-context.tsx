import { getRealTimeCollaborators, type Organization, type UserPresence } from 'insomnia-api';
import React, { createContext, type FC, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useFetchers, useParams, useRevalidator } from 'react-router';
import * as reactUse from 'react-use';

import { CDN_INVALIDATION_TTL } from '~/common/constants';
import { useRootLoaderData } from '~/root';
import { useClearVaultKeyFetcher } from '~/routes/auth.clear-vault-key';
import { useProjectIndexLoaderData } from '~/routes/organization.$organizationId.project.$projectId._index';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useInsomniaSyncDataActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.insomnia-sync.sync-data';
import { useStorageRulesActionFetcher } from '~/routes/organization.$organizationId.storage-rules';
import { useOrganizationSyncProjectsActionFetcher } from '~/routes/organization.$organizationId.sync-projects';
import { useOrganizationSyncActionFetcher } from '~/routes/organization.sync';
import { VCSInstance } from '~/sync/vcs/insomnia-sync';
import { avatarImageCache } from '~/ui/hooks/image-cache';

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

  const { userSession } = useRootLoaderData()!;
  const projectData = useProjectIndexLoaderData();
  const workspaceData = useWorkspaceLoaderData();
  const remoteId = projectData?.activeProject?.remoteId || workspaceData?.activeProject.remoteId;

  const [presence, setPresence] = useState<UserPresence[]>([]);
  const { submit: syncOrganizationsSubmit } = useOrganizationSyncActionFetcher();
  const { submit: syncStorageRulesSubmit } = useStorageRulesActionFetcher();
  const { submit: syncProjectsSubmit } = useOrganizationSyncProjectsActionFetcher();
  const { submit: syncDataSubmit } = useInsomniaSyncDataActionFetcher();
  const { submit: clearVaultKeySubmit } = useClearVaultKeyFetcher();

  const latestProjectId = reactUse.useLatest(projectId);
  const latestWorkspaceId = reactUse.useLatest(workspaceId);
  const latestRemoteId = reactUse.useLatest(remoteId);

  // Update presence when the user switches org, projects, workspaces
  useEffect(() => {
    async function updatePresence() {
      const sessionId = userSession.id;
      if (sessionId && remoteId) {
        try {
          const response = await getRealTimeCollaborators({
            sessionId,
            organizationId: sanitizeTeamId(organizationId),
            projectRemoteId: remoteId,
            workspaceId,
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
  const inflightFetchers = useFetchers();
  const ifInSubmission = inflightFetchers.some(f => f.formMethod === 'POST');
  const latestInSubmission = reactUse.useLatest(ifInSubmission);

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
              syncOrganizationsSubmit();
            } else if (event.type === 'StorageRuleChanged' && event.team && event.team.includes('org_')) {
              syncStorageRulesSubmit({
                organizationId: event.team,
              });
            } else if (event.type === 'TeamProjectChanged' && event.team === organizationId) {
              syncProjectsSubmit({
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
              if (!latestInSubmission.current) {
                revalidate();
              }
            } else if (event.type === 'VaultKeyChanged') {
              const accountId = userSession.accountId;
              const organizations = JSON.parse(
                localStorage.getItem(`${accountId}:organizations`) || '[]',
              ) as Organization[];
              clearVaultKeySubmit({
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
                syncDataSubmit({
                  organizationId: organizationId,
                  projectId: latestProjectId.current,
                  workspaceId: latestWorkspaceId.current,
                });
                // FileChanged could be a new file has been added, we need to revalidate the workspace list
              } else if (event.type === 'FileChanged' && !latestWorkspaceId.current && !latestInSubmission.current) {
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
    clearVaultKeySubmit,
    latestProjectId,
    latestRemoteId,
    latestWorkspaceId,
    organizationId,
    revalidate,
    syncDataSubmit,
    syncOrganizationsSubmit,
    syncProjectsSubmit,
    syncStorageRulesSubmit,
    userSession.accountId,
    userSession.id,
    latestInSubmission,
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
