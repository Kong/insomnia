import React, { createContext, type FC, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';

import { CDN_INVALIDATION_TTL } from '../../../common/constants';
import { insomniaFetch } from '../../../ui/insomniaFetch';
import { avatarImageCache } from '../../hooks/image-cache';
import type { OrganizationLoaderData } from '../../routes/organization';
import type { ProjectIdLoaderData } from '../../routes/project';
import { useRootLoaderData } from '../../routes/root';
import type { WorkspaceLoaderData } from '../../routes/workspace';

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
};

interface FileDeletedEvent {
  'topic': string;
  'type': 'FileDeleted';
  'team': string;
  'project': string;
  'file': string;
};

interface BranchDeletedEvent {
  'topic': string;
  'type': 'BranchDeleted';
  'team': string;
  'project': string;
  'file': string;
  'branch': string;
}

interface FileChangedEvent {
  'topic': string;
  'type': 'FileChanged';
  'team': string;
  'project': string;
  'file': string;
  'branch': string;
}

interface VaultKeyChangeEvent {
  type: 'VaultKeyChanged';
  topic: string;
  sessionId: string;
};

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

export const InsomniaEventStreamProvider: FC<PropsWithChildren> = ({ children }) => {
  const {
    organizationId,
    projectId,
    workspaceId,
  } = useParams() as {
    organizationId: string;
      projectId: string;
      workspaceId: string;
  };

  const { userSession } = useRootLoaderData();
  const projectData = useRouteLoaderData('/project/:projectId') as ProjectIdLoaderData | null;
  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | null;
  const { organizations } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const remoteId = projectData?.activeProject?.remoteId || workspaceData?.activeProject.remoteId;

  const [presence, setPresence] = useState<UserPresence[]>([]);
  const syncOrganizationsFetcher = useFetcher();
  const syncStorageRuleFetcher = useFetcher();
  const syncProjectsFetcher = useFetcher();
  const syncDataFetcher = useFetcher();
  const clearVaultKeyFetcher = useFetcher();

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

  useEffect(() => {
    const sessionId = userSession.id;
    if (sessionId) {
      try {
        const source = new EventSource(`insomnia-event-source://v1/teams/${sanitizeTeamId(organizationId)}/streams?sessionId=${sessionId}`);

        source.addEventListener('message', e => {
          try {
            const event = JSON.parse(e.data) as UserPresenceEvent | TeamProjectChangedEvent | FileDeletedEvent | BranchDeletedEvent | FileChangedEvent | VaultKeyChangeEvent;
            if (event.type === 'PresentUserLeave') {
              setPresence(prev => prev.filter(p => {
                const isSameUser = p.acct === event.acct;
                const isSameProjectFile = p.file === event.file && p.project === event.project;

                // Remove any presence events we have for the same user in this project/file
                if (isSameUser && isSameProjectFile) {
                  return false;
                }

                return true;
              }));
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
              syncOrganizationsFetcher.submit({}, {
                action: '/organization/sync',
                method: 'POST',
              });
            } else if (event.type === 'StorageRuleChanged' && event.team && event.team.includes('org_')) {
              const orgId = event.team;

              syncStorageRuleFetcher.submit({}, {
                action: `/organization/${orgId}/sync-storage-rule`,
                method: 'POST',
              });
            } else if (event.type === 'TeamProjectChanged' && event.team === organizationId) {
              syncProjectsFetcher.submit({}, {
                action: `/organization/${organizationId}/sync-projects`,
                method: 'POST',
              });
            } else if (event.type === 'FileDeleted' && event.team === organizationId && remoteId && event.project === remoteId) {
              syncProjectsFetcher.submit({}, {
                action: `/organization/${organizationId}/sync-projects`,
                method: 'POST',
              });
            } else if (event.type === 'VaultKeyChanged') {
              clearVaultKeyFetcher.submit({
                organizations: organizations?.map(org => org.id) || [],
                sessionId: event.sessionId,
              }, {
                action: '/auth/clearVaultKey',
                method: 'POST',
                encType: 'application/json',
              });
            } else if (['BranchDeleted', 'FileChanged'].includes(event.type) && event.team === organizationId && remoteId && event.project === remoteId) {
              syncDataFetcher.submit({}, {
                method: 'POST',
                action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/insomnia-sync/sync-data`,
              });
            };
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
  }, [clearVaultKeyFetcher, organizationId, organizations, projectId, remoteId, syncDataFetcher, syncOrganizationsFetcher, syncProjectsFetcher, syncStorageRuleFetcher, userSession.id, workspaceId]);

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
