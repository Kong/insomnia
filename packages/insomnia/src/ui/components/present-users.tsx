import React from 'react';
import { useParams } from 'react-router-dom';

import { getAccountId } from '../../account/session';
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

  const accountId = getAccountId();

  const activeUsers = presence
    .filter(p => {
      return p.project === projectId && p.file === workspaceId;
    })
    .filter(p => p.acct !== accountId);

  return (
    <AvatarGroup
      animate
      size="medium"
      items={activeUsers.map(user => {
        return {
          key: user.acct,
          alt:
            user.firstName || user.lastName
              ? `${user.firstName} ${user.lastName}`
              : user.acct,
          src: user.avatar,
        };
      })}
    />
  );
};
