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
