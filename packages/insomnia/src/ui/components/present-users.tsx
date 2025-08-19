import { useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useProjectLoaderData } from '~/routes/organization.$organizationId.project.$projectId';

import { useWorkspaceLoaderData } from '../../routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useInsomniaEventStreamContext } from '../context/app/insomnia-event-stream-context';
import { AvatarGroup } from './avatar';

export const PresentUsers = () => {
  const { presence } = useInsomniaEventStreamContext();
  const { workspaceId } = useParams() as { workspaceId: string };
  const { userSession } = useRootLoaderData()!;
  const projectData = useProjectLoaderData();
  const workspaceData = useWorkspaceLoaderData();
  const remoteId = projectData?.activeProject?.remoteId || workspaceData?.activeProject.remoteId;

  if (!presence || !remoteId) {
    return null;
  }

  const activeUsers = presence
    .filter(p => {
      return p.project === remoteId && p.file === workspaceId;
    })
    .filter(p => p.acct !== userSession.accountId)
    .map(user => {
      return {
        key: user.acct,
        alt: user.firstName || user.lastName ? `${user.firstName} ${user.lastName}` : user.acct,
        src: user.avatar,
      };
    });

  return <AvatarGroup size="medium" items={activeUsers} />;
};
