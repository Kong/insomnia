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

  console.log('presence', presence);

  useEffect(() => {
    async function updatePresence() {
      const response = await fetch(`api://v1/teams/${sanitizeTeamId(organizationId)}/collaborators`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': getCurrentSessionId() || '',
        },
        body: JSON.stringify({
          'project': projectId,
          'file': workspaceId,
        }),
      });

      const json = await response.json() as {
        data: Omit<UserPresence, 'firstName' | 'lastName'> & {
          first: string;
          last: string;
        }[];
      };

      console.log('json', json);

      setPresence(json.data.map(p => {
        return {
          ...p,
          firstName: p.first,
          lastName: p.last,
        };
      }));

    }

    updatePresence();
  }, [organizationId, projectId, workspaceId]);

  useEffect(() => {
    const startStream = async () => {
      try {
        const response = await fetch(`streamapi://v1/teams/${sanitizeTeamId(organizationId)}/streams`,
          {
            headers: new Headers({
              'Accept': 'text/event-stream',
              'X-Session-Id': getCurrentSessionId() || '',
            }),
          });

        const bodyStream = response.body?.getReader();

        if (bodyStream) {
          const read = async () => {
            try {
              const { done, value } = await bodyStream.read();

              console.log({ done, value });

              if (done) {
                return;
              }
              const data = new TextDecoder('utf-8').decode(value);

              const [id, event, payload] = data.split('\n').map(s => s.trim()).map(s => {
                const removeTextBeforeFirstColon = s.split(':').slice(1).join(':');

                return removeTextBeforeFirstColon.trim();
              });

              console.log({ id, event, payload });

              if (event === 'message') {
                const presenceEvent = JSON.parse(payload) as UserPresenceEvent;

                if (presenceEvent.type === 'PresentUserLeave') {
                  console.log('User Left', presenceEvent);
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
        presence: presence,
      }}
    >
      {children}
    </PresenceContext.Provider>
  );
};

export const usePresenceContext = () => useContext(PresenceContext);
