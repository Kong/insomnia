import React from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';

import { getAccountId } from '../../account/session';
import { usePresenceContext } from '../context/app/presence-context';
import { ProjectsLoaderData } from '../routes/project';
import { AvatarGroup } from './avatar';

export const PresentUsers = () => {
  const { presence } = usePresenceContext();
  const { workspaceId } = useParams() as { workspaceId: string };
  const projectData = useRouteLoaderData('/project') as ProjectsLoaderData | null;
  const remoteId = projectData?.activeProject.remoteId;

  if (!presence || !remoteId) {
    return null;
  }

  const accountId = getAccountId();

  const activeUsers = presence
    .filter(p => {
      return p.project === remoteId && p.file === workspaceId;
    })
    .filter(p => p.acct !== accountId)
    .map(user => {
      return {
        key: user.acct,
        alt:
          user.firstName || user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.acct,
        src: user.avatar,
      };
    });

  return (
    <AvatarGroup
      animate
      size="medium"
      items={activeUsers}
    />
  );
};
