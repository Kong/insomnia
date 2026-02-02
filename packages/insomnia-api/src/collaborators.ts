import { fetch } from './fetch';

type CollaboratorType = 'invite' | 'member' | 'group';
interface CollaboratorMetadata {
  groupId?: string;
  invitationId?: string;
  roleId?: string;
  email?: string;
  userId?: string;
  expiresAt?: string;
  groupTotal?: number;
}

export interface Collaborator {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
  createdAt?: string;
  metadata: CollaboratorMetadata;
}

interface PaginatedList {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
}

type CollaboratorsListResult = PaginatedList & {
  collaborators: Collaborator[];
};

export const getCollaborators = ({
  sessionId,
  organizationId,
  pageLimit = 25,
  page,
  filter,
}: {
  sessionId: string;
  organizationId: string;
  filter?: string;
  pageLimit?: number;
  page?: number;
}) => {
  const params = new URLSearchParams();
  params.set('per_page', String(pageLimit));
  if (page !== undefined) {
    params.set('page', String(page));
  }
  if (filter !== undefined) {
    params.set('filter', filter);
  }
  return fetch<CollaboratorsListResult>({
    method: 'GET',
    path: `/v1/desktop/organizations/${organizationId}/collaborators?${params.toString()}`,
    sessionId,
  });
};

interface CollaboratorSearchResultItem {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
}

export const searchCollaborators = ({
  sessionId,
  organizationId,
  keyword,
}: {
  sessionId: string;
  organizationId: string;
  keyword: string;
}) => {
  return fetch<CollaboratorSearchResultItem[]>({
    method: 'GET',
    path: `/v1/desktop/organizations/${organizationId}/collaborators/search/${keyword}`,
    sessionId,
  });
};

interface CollaboratorInstructionItem {
  accountId: string;
  publicKey: string; // stringified JSON WEB KEY
  autoLinked: boolean;
}

type CollaboratorInstruction = Record<string, CollaboratorInstructionItem>;

export const startAddingCollaborators = ({
  sessionId,
  organizationId,
  emails,
  teamIds,
}: {
  sessionId: string;
  organizationId: string;
  emails: string[];
  teamIds: string[];
}) => {
  return fetch<CollaboratorInstruction>({
    method: 'POST',
    path: `/v1/desktop/organizations/${organizationId}/collaborators/start-adding`,
    data: { teamIds, emails },
    sessionId,
  });
};

interface CollaboratorInviteKey {
  accountId: string;
  projectId: string;
  encKey: string;
}

export const finishAddingCollaborators = ({
  sessionId,
  organizationId,
  teamIds,
  keys,
  accountIds,
  roleId,
}: {
  sessionId: string;
  organizationId: string;
  teamIds: string[];
  keys: Record<string, Record<string, CollaboratorInviteKey>>;
  accountIds: string[];
  roleId?: string;
}) => {
  return fetch({
    method: 'POST',
    path: `/v1/desktop/organizations/${organizationId}/collaborators/finish-adding`,
    data: { teamIds, keys, accountIds, roleId },
    sessionId,
  });
};

export const unlinkCollaborator = ({
  sessionId,
  organizationId,
  collaboratorId,
}: {
  sessionId: string;
  organizationId: string;
  collaboratorId: string;
}) => {
  return fetch({
    method: 'DELETE',
    path: `/v1/desktop/organizations/${organizationId}/collaborators/${collaboratorId}/unlink`,
    sessionId,
  });
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

export const getRealTimeCollaborators = ({
  sessionId,
  // this is sanitized organization id
  organizationId,
  projectRemoteId,
  workspaceId,
}: {
  sessionId: string;
  organizationId: string;
  projectRemoteId: string;
  workspaceId: string;
}) => {
  return fetch<{
    data?: UserPresence[];
  }>({
    path: `/v1/organizations/${organizationId}/collaborators`,
    method: 'POST',
    sessionId,
    data: {
      project: projectRemoteId,
      file: workspaceId,
    },
  });
};
