import { fetch } from './fetch';

export const reinvite = ({
  organizationId,
  invitationId,
  sessionId,
}: {
  organizationId: string;
  invitationId: string;
  sessionId: string;
}) => {
  return fetch({
    method: 'POST',
    path: `/v1/organizations/${organizationId}/invites/${invitationId}/reinvite`,
    sessionId,
  });
};

export const updateInvitationRole = ({
  organizationId,
  invitationId,
  roleId,
  sessionId,
}: {
  organizationId: string;
  invitationId: string;
  roleId: string;
  sessionId: string;
}) => {
  return fetch({
    method: 'PATCH',
    path: `/v1/organizations/${organizationId}/invites/${invitationId}`,
    data: { roles: [roleId] },
    sessionId,
  });
};

export const revokeInvitation = ({
  organizationId,
  invitationId,
  sessionId,
}: {
  organizationId: string;
  invitationId: string;
  sessionId: string;
}) => {
  return fetch({
    method: 'DELETE',
    path: `/v1/organizations/${organizationId}/invites/${invitationId}`,
    sessionId,
  });
};

export interface ProjectKey {
  projectId: string;
  encKey: string;
}

export interface ProjectMember {
  accountId: string;
  projectId: string;
  publicKey: string;
}

interface ResponseGetMyProjectKeys {
  projectKeys: ProjectKey[];
  members: ProjectMember[];
}

export interface MemberProjectKey {
  accountId: string;
  projectId: string;
  encSymmetricKey: string;
}

export const getMyProjectKeys = ({ organizationId, sessionId }: { organizationId: string; sessionId: string }) => {
  return fetch<ResponseGetMyProjectKeys>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/my-project-keys`,
    sessionId,
  });
};

export const reconcileFileKeys = ({
  organizationId,
  memberKeys,
  sessionId,
}: {
  organizationId: string;
  memberKeys: MemberProjectKey[];
  sessionId: string;
}) => {
  return fetch({
    method: 'POST',
    path: `/v1/organizations/${organizationId}/reconcile-keys`,
    sessionId,
    data: { keys: memberKeys },
  });
};
