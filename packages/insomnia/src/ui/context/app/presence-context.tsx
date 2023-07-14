import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useInterval } from 'react-use';

import { getCurrentSessionId } from '../../../account/session';

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
  type: 'PresentUserLeave' | 'PresentStateChanged';
}

export const PresenceProvider: FC<PropsWithChildren> = ({ children }) => {
  const {
    organizationId,
    projectId,
    workspaceId,
  } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const [presence, setPresence] = useState<UserPresence[]>([]);

  // Update presence when the app window closes
  useEffect(() => {
    const sessionId = getCurrentSessionId();

    if (!sessionId) {
      return;
    }

    const handleWindowClose = async () => {
      try {
        const response = await window.main.insomniaFetch<{
            data: UserPresence[];
          }>({
            path: `/v1/teams/${sanitizeTeamId(organizationId)}/collaborators`,
            method: 'POST',
            sessionId,
            data: {
              project: '',
              file: '',
            },
          });

        if (response?.data?.length > 0) {
          setPresence(response.data);
        }
      } catch (e) {
        console.log('Error parsing response', e);
      }
    };

    window.addEventListener('beforeunload', handleWindowClose);
    return () => {
      window.removeEventListener('beforeunload', handleWindowClose);
    };
  }, [organizationId]);

  // Update presence when the user switches org, projects, workspaces
  useEffect(() => {
    async function updatePresence() {
      const sessionId = getCurrentSessionId();
      if (sessionId) {
        try {
          const response = await window.main.insomniaFetch<{
              data: UserPresence[];
            }>({
              path: `/v1/teams/${sanitizeTeamId(organizationId)}/collaborators`,
              method: 'POST',
              sessionId,
              data: {
                project: projectId,
                file: workspaceId,
              },
            });

          const { data } = response;
          if (data.length > 0) {
            setPresence(response.data);
          }
        } catch (e) {
          console.log('Error parsing response', e);
        }
      }
    }

    updatePresence();
  }, [organizationId, projectId, workspaceId]);

  // Update presence every minute
  useInterval(async () => {
    const sessionId = getCurrentSessionId();
    if (sessionId) {
      try {
        const response = await window.main.insomniaFetch<{
                data: UserPresence[];
              }>({
                path: `/v1/teams/${sanitizeTeamId(organizationId)}/collaborators`,
                method: 'POST',
                sessionId,
                data: {
                  project: projectId,
                  file: workspaceId,
                },
              });

        const { data } = response;
        if (data.length > 0) {
          setPresence(response.data);
        }
      } catch (e) {
        console.log('Error parsing response', e);
      }
    }
  }, 1000 * 30);

  useEffect(() => {
    const sessionId = getCurrentSessionId();

    if (!sessionId) {
      return;
    }

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

  }, [organizationId]);

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
