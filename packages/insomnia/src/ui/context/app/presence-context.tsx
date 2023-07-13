import React, { createContext, FC, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getCurrentSessionId } from '../../../account/session';

const PresenceContext = createContext<{
  presence: UserPresence[];
}>({
  presence: [],
});

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
  type: string;
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

        const { data } = response;
        if (data.length > 0) {
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

  useEffect(() => {
    const sessionId = getCurrentSessionId();

    if (!sessionId) {
      return;
    }

    const startStream = async () => {
      try {
        const response = await fetch(`eventsource://v1/teams/${sanitizeTeamId(organizationId)}/streams`,
          {
            headers: new Headers({
              'Accept': 'text/event-stream',
              'X-Session-Id': sessionId,
            }),
          });

        const bodyStream = response.body?.getReader();

        if (bodyStream) {
          const read = async () => {
            try {
              const { done, value } = await bodyStream.read();

              if (done) {
                return;
              }

              const data = new TextDecoder('utf-8').decode(value);

              const [, event, payload] = data.split('\n').map(s => s.trim()).map(s => {
                const removeTextBeforeFirstColon = s.split(':').slice(1).join(':');

                return removeTextBeforeFirstColon.trim();
              });

              if (event === 'message') {
                const presenceEvent = JSON.parse(payload) as UserPresenceEvent;

                if (presenceEvent.type === 'PresentUserLeave') {
                  setPresence(prev => prev.filter(p => {
                    if (p.acct === presenceEvent.acct && p.file === presenceEvent.file && p.project === presenceEvent.project) {
                      return false;
                    }

                    return true;
                  }));
                } else if (presenceEvent.type === 'PresentStateChanged') {
                  setPresence(prev => [...prev.filter(p => p.acct !== presenceEvent.acct), presenceEvent]);
                }
              }

              read();
            } catch (e) {
              console.log('Error Reading body', e);
            }
          };

          read();
        }
      } catch (e) {
        console.log('ERROR', e);
      }
    };

    startStream();
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
