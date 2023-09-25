import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import { useInterval } from 'react-use';

import { getCurrentSessionId } from '../../../account/session';
import { ProjectsLoaderData } from '../../routes/project';

const PresenceContext = createContext<{
  presence: UserPresence[];
}>({
  presence: [],
});

// This happens because the API accepts teamIds as team_xxx
function sanitizeTeamId(teamId: string) {
  return teamId.replace('proj_', '');
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
  type: 'PresentUserLeave' | 'PresentStateChanged' | 'OrganizationChanged';
}

export const PresenceProvider: FC<PropsWithChildren> = ({ children }) => {
  const {
    organizationId,
    workspaceId,
  } = useParams() as {
    organizationId: string;
    workspaceId: string;
  };

  const projectData = useRouteLoaderData('/project') as ProjectsLoaderData | null;
  const remoteId = projectData?.activeProject.remoteId;
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const syncOrganizationsFetcher = useFetcher();

  // Update presence when the user switches org, projects, workspaces
  useEffect(() => {
    async function updatePresence() {
      const sessionId = getCurrentSessionId();
      if (sessionId && remoteId) {
        try {
          const response = await window.main.insomniaFetch<{
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
          console.log('Error parsing response', e);
        }
      }
    }

    updatePresence();
  }, [organizationId, remoteId, workspaceId]);

  // Update presence every minute
  useInterval(async () => {
    const sessionId = getCurrentSessionId();
    if (sessionId && remoteId) {
      try {
        const response = await window.main.insomniaFetch<{
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
        console.log('Error parsing response', e);
      }
    }
  }, 1000 * 60);

  useEffect(() => {
    const sessionId = getCurrentSessionId();
    if (sessionId && remoteId) {
      try {
        const source = new EventSource(`insomnia-event-source://v1/teams/${sanitizeTeamId(organizationId)}/streams?sessionId=${sessionId}`);

        source.addEventListener('message', e => {
          try {
            const presenceEvent = JSON.parse(e.data) as UserPresenceEvent;

            if (presenceEvent.type === 'PresentUserLeave') {
              setPresence(prev => prev.filter(p => {
                const isSameUser = p.acct === presenceEvent.acct;
                const isSameProjectFile = p.file === presenceEvent.file && p.project === presenceEvent.project;

                // Remove any presence events we have for the same user in this project/file
                if (isSameUser && isSameProjectFile) {
                  return false;
                }

                return true;
              }));
            } else if (presenceEvent.type === 'PresentStateChanged') {
              setPresence(prev => [...prev.filter(p => p.acct !== presenceEvent.acct), presenceEvent]);
            } else if (presenceEvent.type === 'OrganizationChanged') {
              syncOrganizationsFetcher.submit({}, {
                action: '/organization/sync',
                method: 'POST',
              });
            }
          } catch (e) {
            console.log('Error parsing response from SSE', e);
          }
        });
        return () => {
          source.close();
        };
      } catch (e) {
        console.log('ERROR', e);
        return;
      }
    }
    return;
  }, [organizationId, remoteId, syncOrganizationsFetcher]);

  return (
    <PresenceContext.Provider
      value={{
        presence,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresenceContext = () => useContext(PresenceContext);
