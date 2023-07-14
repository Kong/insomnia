import React from 'react';
import { useParams } from 'react-router-dom';

import { usePresenceContext } from '../context/app/presence-context';
import { AvatarGroup } from './avatar';

export const PresentUsers = () => {
  const { presence } = usePresenceContext();
  const { projectId, workspaceId } = useParams() as {
    workspaceId: string;
    projectId: string;
  };

  if (!presence) {
    return null;
  }

  const activeUsers = presence.filter(p => {
    return p.project === projectId && p.file === workspaceId;
  });

  return (
    <AvatarGroup
      animate
      size="medium"
      items={activeUsers.map(activeUser => {
        return {
          key: activeUser.acct,
          alt:
            activeUser.firstName || activeUser.lastName
              ? `${activeUser.firstName} ${activeUser.lastName}`
              : activeUser.acct,
          src: activeUser.avatar,
        };
      })}
    />
  );
};
