import type { ActionFunction, LoaderFunction } from 'react-router-dom';

import { userSession } from '../../models';
import * as models from '../../models';
import { invariant } from '../../utils/invariant';
import { insomniaFetch } from '../insomniaFetch';

interface PaginatedList {
  start: number;
  limit: number;
  length: number;
  total: number;
  next: string;
};

export type CollaboratorType = 'invite' | 'member' | 'group';

interface CollaboratorMetadata {
  groupId?: string;
  invitationId?: string;
  roleId?: string;
  email?: string;
  userId?: string;
  expiresAt?: string;
  groupTotal?: number;
};

export interface Collaborator {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
  createdAt?: string;
  metadata: CollaboratorMetadata;
};

export type CollaboratorsListLoaderResult = PaginatedList & {
  collaborators: Collaborator[];
} | Error;

export const collaboratorsListLoader: LoaderFunction = async ({ params, request }): Promise<CollaboratorsListLoaderResult> => {
  const { id: sessionId } = await userSession.get();

  const { organizationId } = params;

  try {
    const requestUrl = new URL(request.url);
    const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

    // Construct the base path
    let path = `/v1/desktop/organizations/${organizationId}/collaborators?per_page=${searchParams.per_page || 25}`;

    // Append query parameters conditionally
    if (searchParams.page) {
      path += `&page=${searchParams.page}`;
    }

    if (searchParams.filter) {
      path += `&filter=${searchParams.filter}`;
    }

    const collaboratorsList = await insomniaFetch<CollaboratorsListLoaderResult>({
      method: 'GET',
      path,
      sessionId,
    });

    return collaboratorsList;
  } catch (err) {
    return new Error(err.message);
  }
};

export interface CollaboratorSearchResultItem {
  id: string;
  picture: string;
  type: CollaboratorType;
  name: string;
};

export type CollaboratorSearchLoaderResult = CollaboratorSearchResultItem[];

export const collaboratorSearchLoader: LoaderFunction = async ({ params, request }): Promise<CollaboratorSearchLoaderResult> => {
  const { id: sessionId } = await userSession.get();

  const { organizationId } = params;

  try {
    const requestUrl = new URL(request.url);
    const searchParams = Object.fromEntries(requestUrl.searchParams.entries());

    const collaboratorsSearchList = await insomniaFetch<CollaboratorSearchLoaderResult>({
      method: 'GET',
      path: `/v1/desktop/organizations/${organizationId}/collaborators/search/${searchParams.query}`,
      sessionId,
    });

    return collaboratorsSearchList;
  } catch (err) {
    return [];
  }
};

export const reinviteCollaboratorAction: ActionFunction = async ({ params }) => {
  const { organizationId, invitationId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof invitationId === 'string', 'Invitation ID is required');

  try {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'POST',
      path: `/v1/organizations/${organizationId}/invites/${invitationId}/reinvite`,
      sessionId,
    });

    return response;
  } catch (err) {
    throw new Error('Failed to reinvite member. Please try again.');
  }
};

export const updateInvitationRoleAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, invitationId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof invitationId === 'string', 'Invitation ID is required');

  const formData = await request.formData();

  const roleId = formData.get('roleId');
  invariant(typeof roleId === 'string', 'Role ID is required');

  try {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'PATCH',
      path: `/v1/organizations/${organizationId}/invites/${invitationId}`,
      data: { roles: [roleId] },
      sessionId,
    });

    return response;
  } catch (err) {
    throw new Error('Failed to reinvite member. Please try again.');
  }
};

export const updateMemberRoleAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, userId } = params;

  invariant(typeof organizationId === 'string', 'Organization ID is required');
  invariant(typeof userId === 'string', 'User ID is required');

  const formData = await request.formData();

  const roleId = formData.get('roleId');
  invariant(typeof roleId === 'string', 'Role ID is required');

  try {
    const user = await models.userSession.getOrCreate();
    const sessionId = user.id;

    const response = await insomniaFetch<{ enabled: boolean }>({
      method: 'PATCH',
      path: `/v1/organizations/${organizationId}/members/${userId}/roles`,
      data: { roles: [roleId] },
      sessionId,
    });

    return response;
  } catch (err) {
    throw new Error('Failed to update organization member roles');
  }
};
