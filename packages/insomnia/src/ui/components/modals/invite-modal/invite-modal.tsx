import React, { type FC, type MutableRefObject, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Group, Heading, Input, ListBox, ListBoxItem, Modal, ModalOverlay, TextField } from 'react-aria-components';
import { useParams } from 'react-router-dom';

import { getAccountId, getCurrentSessionId } from '../../../../account/session';
import defaultAvatarImg from '../../../../ui/images/default-avatar.svg';
import { invariant } from '../../../../utils/invariant';
import { SegmentEvent } from '../../../analytics';
import { insomniaFetch } from '../../../insomniaFetch';
import { Icon } from '../../icon';
import { InviteForm } from './organization-invite-form';
import { OrganizationMemberRolesSelector, type Role, SELECTOR_TYPE } from './organization-member-roles-selector';

const InviteModal: FC<{
  setIsOpen: (isOpen: boolean) => void;
  organizationId: string;
  allRoles: Role[];
  currentUserRoleInOrg: Role;
  orgFeatures: Features;
  permissionRef: MutableRefObject<Record<Permission, boolean>>;
  isCurrentUserOrganizationOwner: boolean;
  currentUserAccountId: string;
  revalidateCurrentUserRoleAndPermissionsInOrg: (organizationId: string) => Promise<[void, void]>;
}> = ({
  setIsOpen,
  organizationId,
  allRoles,
  currentUserRoleInOrg,
  orgFeatures,
  permissionRef,
  isCurrentUserOrganizationOwner,
  currentUserAccountId,
  revalidateCurrentUserRoleAndPermissionsInOrg,
}) => {
  const [queryInputString, setQueryInputString] = useState('');
  const {
    queryPageFunctionsRef,
    membersInCurrentPage,
    hasNextPage,
    hasPrevPage,
    loading,
    queryStringRef,
    totalMemberCount,
  } = usePagination(permissionRef);

  // query first page when open
  useEffect(() => {
    (async () => {
      await queryPageFunctionsRef.current.queryFirstPage(organizationId);
    })();
  }, [organizationId, queryPageFunctionsRef]);

  const startSearch = useCallback(async (queryStr?: string) => {
    let trimmedInput;
    if (typeof queryStr === 'string') {
      trimmedInput = queryStr.trim();
      setQueryInputString(trimmedInput);
    } else {
      trimmedInput = queryInputString.trim();
    }
    queryStringRef.current = trimmedInput;
    if (organizationId) {
      queryPageFunctionsRef.current.queryFirstPage(organizationId);
    }
  }, [queryInputString, organizationId, queryPageFunctionsRef, queryStringRef]);

  const searchInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <ModalOverlay
      isDismissable={true}
      isOpen={true}
      onOpenChange={setIsOpen}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-[--color-bg] theme--transparent-overlay"
    >
      <Modal className="w-[520px] rounded-md border border-solid border-[--hl-sm] p-[32px] max-h-full bg-[--color-bg] text-[--color-font] theme--dialog">
        <Dialog className="outline-none relative">
          {({ close }) => (<>
            <Heading slot="title" className="text-[22px] leading-[34px] mb-[24px]">
              Invite collaborators
            </Heading>
            <Button onPress={close} className="fa fa-times absolute top-0 right-0 text-xl" />
            {permissionRef.current?.['create:invitation'] && (
              <>
                <InviteForm
                  onInviteCompleted={() => {
                    if (organizationId) {
                      setQueryInputString('');
                      queryStringRef.current = '';
                      queryPageFunctionsRef.current.queryFirstPage(organizationId);
                    }
                  }}
                  allRoles={allRoles}
                />
                <hr className="border my-[24px]" />
              </>
            )}

            <div className='flex justify-between leading-[24px] mb-[16px]'>
              <p>WHO HAS ACCESS ({totalMemberCount})</p>
              <Group
                className="relative w-[173px] bg-[--hl-xs] group/search py-[4px] pl-[12px] rounded"
                isDisabled={loading}
                onClick={() => {
                  searchInputRef.current?.focus();
                }}
              >
                <i
                  className="fa fa-search"
                />
                <TextField
                  onKeyDown={event => {
                    if (event.code === 'Enter') {
                      startSearch();
                    }
                  }}
                  value={queryInputString}
                  onChange={setQueryInputString}
                  aria-label="Member search query"
                  className="inline-block ml-2"
                >
                  <Input className="w-[130px]" ref={ searchInputRef } />
                </TextField>
                <Button
                  className={`absolute inset-y-0 right-[12px] my-auto fa fa-circle-xmark ${queryInputString ? 'opacity-100' : 'opacity-0'}`}
                  onPress={() => startSearch('')}
                />
              </Group>
            </div>
            {loading ?
              (<Icon icon="spinner" className="text-[--color-font] block animate-spin m-auto" />) :
              (membersInCurrentPage.length === 0 ? (
                <p className='text-center'>
                  {queryStringRef.current
                    ? `No member found for the search "${queryStringRef.current}"`
                    : 'No member'
                  }
                </p>
              ) : (
                <ListBox
                  aria-label="Invitation list"
                  items={membersInCurrentPage}
                  className="flex flex-col gap-0"
                >
                  {member => {
                    const isAcceptedMember = member.itemType === ITEM_TYPE.ACCEPTED_MEMBER;
                    const isPendingMember = member.itemType === ITEM_TYPE.PENDING_MEMBER;
                    const textValue = isAcceptedMember ? member.name : member.invitee.email;
                    const isCurrentUser = isAcceptedMember && currentUserAccountId === member.user_id;
                    return ((
                      <ListBoxItem
                        id={isAcceptedMember ? member.user_id : member.id}
                        textValue={textValue}
                        className='flex justify-between outline-none gap-[16px] leading-[36px]'
                      >
                        <div className="grow truncate pl-[32px] relative">
                          <img src={(isAcceptedMember && member.picture) ? member.picture : defaultAvatarImg} alt="member image" className="w-[24px] h-[24px] rounded-full absolute left-0 bottom-0 top-0 m-auto" />
                          {textValue}
                          {isCurrentUser && ' (You)'}
                          {isPendingMember && ' (Invite sent)'}
                        </div>
                        <div className='w-[88px] shrink-0'>
                          <OrganizationMemberRolesSelector
                            {...{
                              type: SELECTOR_TYPE.UPDATE,
                              availableRoles: allRoles,
                              memberRoles: isAcceptedMember ? [member.role_name] : member.roles,
                              userRole: currentUserRoleInOrg as Role,
                              isDisabled: isAcceptedMember && member.role_name === 'owner',
                              isRBACEnabled: Boolean(orgFeatures?.features.orgBasicRbac?.enabled),
                              isUserOrganizationOwner: isCurrentUserOrganizationOwner,
                              hasPermissionToChangeRoles: permissionRef.current['update:membership'],
                              async onRoleChange(role: Role) {
                                if (isAcceptedMember) {
                                  await updateMemberRole(role.id, member.user_id, organizationId);
                                  if (isCurrentUser) {
                                    await revalidateCurrentUserRoleAndPermissionsInOrg(organizationId);
                                    await queryPageFunctionsRef.current.reloadCurrentPage(organizationId);
                                  }
                                } else {
                                  await updateInvitationRole(role.id, member.id, organizationId);
                                }
                              },
                            }}
                          />
                        </div>
                        {isAcceptedMember ? (
                          <Button
                            aria-label="Delete member button"
                            className='w-[64px] shrink-0 text-right'
                            isDisabled={
                              !permissionRef.current['delete:membership']
                              || member.role_name === 'owner'
                              || isCurrentUser
                            }
                            onPress={() => {
                              deleteMember(organizationId, member.user_id).then(() => {
                                queryPageFunctionsRef.current.reloadCurrentPage(organizationId);
                              });
                            }}
                          >
                            Remove
                          </Button>
                        ) : (<Button
                          aria-label="Revoke invite button"
                          className='w-[64px] shrink-0 text-right'
                          onPress={() => {
                            revokeOrganizationInvite(organizationId, member.id).then(() => {
                              queryPageFunctionsRef.current.reloadCurrentPage(organizationId);
                            });
                          }}
                        >
                          Revoke
                        </Button>)}
                      </ListBoxItem>
                    ));
                  }}
                </ListBox>
              ))
            }
            {(hasPrevPage || hasNextPage) && (
              <div className='flex justify-between mt-[24px] leading-[19px]'>
                <Button
                  onPress={() => {
                    queryPageFunctionsRef.current.queryPrevPage(organizationId as string);
                  }}
                  isDisabled={!hasPrevPage || loading}
                  className={`${!hasPrevPage || loading ? 'opacity-40' : ''}`}
                >
                  <i className="fa fa-caret-left" />
                  Prev
                </Button>
                <Button
                  onPress={() => {
                    queryPageFunctionsRef.current.queryNextPage(organizationId as string);
                  }}
                  isDisabled={!hasNextPage || loading}
                  className={`${!hasNextPage || loading ? 'opacity-40' : ''}`}
                >
                  Next
                  <i className="fa fa-caret-right" />
                </Button>
              </div>
            )}
          </>)}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

// supply information about current org to InviteModal
export const InviteModalContainer: FC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({
  isOpen,
  setIsOpen,
}) => {
  const [loadingOrgInfo, setLoadingOrgInfo] = useState(true);
  const organizationId = useParams().organizationId;
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [currentUserRoleInOrg, setCurrentUserRoleInOrg] = useState<Role | null>(null);
  const [orgFeatures, setOrgFeatures] = useState<Features | null>(null);
  const permissionRef = useRef<Record<Permission, boolean>>();
  const [currentUserAccountId, setCurrentUserAccountId] = useState('');
  const [currentOrgInfo, setCurrentOrgInfo] = useState<OrganizationAuth0 | null>(null);

  const isCurrentUserOrganizationOwner = currentUserAccountId === currentOrgInfo?.metadata.ownerAccountId;

  function getBaseInfo(organizationId: string) {
    return Promise.all([
      getCurrentUserRoleInOrg(organizationId).then(setCurrentUserRoleInOrg),
      getOrganizationFeatures(organizationId).then(setOrgFeatures),
      getCurrentUserPermissionsInOrg(organizationId).then(permissions => {
        permissionRef.current = permissions;
      }),
      getAccountId().then(setCurrentUserAccountId),
      getOrganization(organizationId).then(setCurrentOrgInfo),
    ]);
  }

  function revalidateCurrentUserRoleAndPermissionsInOrg(organizationId: string) {
    return Promise.all([
      getCurrentUserRoleInOrg(organizationId).then(setCurrentUserRoleInOrg),
      getCurrentUserPermissionsInOrg(organizationId).then(permissions => {
        permissionRef.current = permissions;
      }),
    ]);
  }

  // get info every time organizationId changes
  useEffect(() => {
    (async () => {
      if (organizationId) {
        setLoadingOrgInfo(true);
        await Promise.all([
          getAllRoles().then(setAllRoles),
          getBaseInfo(organizationId),
        ]);
        setLoadingOrgInfo(false);
      }
    })();
  }, [organizationId]);

  // get info every time modal is opened
  useEffect(() => {
    if (organizationId && isOpen) {
      getBaseInfo(organizationId);
    }
  }, [organizationId, isOpen]);

  // track event when modal is opened
  useEffect(() => {
    if (isOpen) {
      window.main.trackSegmentEvent({ event: SegmentEvent.inviteTrigger });
    }
  }, [
    isOpen,
  ]);

  if (loadingOrgInfo || !organizationId || !isOpen) {
    return null;
  } else {
    invariant(currentUserRoleInOrg, 'currentUserRoleInOrg should not be null');
    invariant(orgFeatures, 'orgFeatures should not be null');
    if (checkPermissionRefType(permissionRef)) {
      return <InviteModal
        {...{
          setIsOpen,
          organizationId,
          allRoles,
          currentUserRoleInOrg,
          orgFeatures,
          permissionRef,
          isCurrentUserOrganizationOwner,
          currentUserAccountId,
          revalidateCurrentUserRoleAndPermissionsInOrg,
        }}
      />;
    } else {
      return null;
    }
  };
};

enum ITEM_TYPE {
  ACCEPTED_MEMBER,
  PENDING_MEMBER,
};

interface AcceptedMember {
  user_id: string;
  role_name: string;
  picture: string;
  name: string;
  email: string;
  created: string;
  itemType: ITEM_TYPE.ACCEPTED_MEMBER;
}

async function getOrganizationAcceptedMembersByPage({
  organizationId,
  perPage,
  page,
  query,
}: {
  organizationId: string;
  perPage: number;
  page: number;
  query?: string;
}): Promise<{
  members: AcceptedMember[];
  total: number;
}> {
  let total = 0;
  // because this api can not return total number correctly when page is out of range, so I just request page 0 at first to get correct total number
  if (page !== 0) {
    total = (await getOrganizationAcceptedMembersByPage({
      organizationId,
      perPage,
      page: 0,
      query,
    })).total;
  }

  const searchParams = new URLSearchParams();
  searchParams.append('per_page', perPage.toString());
  searchParams.append('page', page.toString());
  if (query) {
    searchParams.append('email', query);
  }
  const data = await insomniaFetch<{
    members: AcceptedMember[];
    total: number;
  }>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/members?${searchParams.toString()}`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  });
  data.members.forEach(member => member.itemType = ITEM_TYPE.ACCEPTED_MEMBER);
  if (page !== 0) {
    data.total = total;
  }
  return data;
}

export interface PendingMember {
  id: string;
  inviter: {
    name: string;
  };
  invitee: {
    email: string;
  };
  created_at: string;
  expires_at: string;
  roles: string[];
  itemType: ITEM_TYPE.PENDING_MEMBER;
}

// this api does not support pagination
async function getAllOrganizationPendingMembers({
  organizationId,
  query,
}: {
  organizationId: string;
  query?: string;
}): Promise<PendingMember[]> {
  const { invitations } = await insomniaFetch<{ invitations: PendingMember[] }>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/invites`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  });
  invitations.forEach(invitation => invitation.itemType = ITEM_TYPE.PENDING_MEMBER);
  if (query) {
    return invitations.filter(invitation => invitation.invitee.email.includes(query));
  }
  return invitations;
};

type Member = AcceptedMember | PendingMember;

const PAGE_SIZE = 8;

/** check and return valid page */
function checkPage(page: number, total: number): number {
  if (page <= 0) {
    return 0;
  }
  const validMaxPage = Math.floor(total / PAGE_SIZE);
  if (page > validMaxPage) {
    return validMaxPage;
  }
  return page;
}

const usePagination = (permissionRef: MutableRefObject<Record<Permission, boolean>>) => {
  // page starts from 0
  const [currentPage, setCurrentPage] = useState(0);
  const [membersInCurrentPage, setMembersInCurrentPage] = useState<Member[]>([]);
  const [totalMemberCount, setTotalMemberCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const queryStringRef = useRef('');

  const queryMembers = useCallback(async (orgId: string, page: number) => {
    setLoading(true);
    page = checkPage(page, totalMemberCount);
    const {
      members: acceptedMembersInCurrentPage,
      total: acceptedMemberCount,
    } = await getOrganizationAcceptedMembersByPage({
      organizationId: orgId,
      perPage: PAGE_SIZE,
      page,
      query: queryStringRef.current,
    });
    invariant(permissionRef.current, 'permissionRef.current should not be undefined');
    const pendingMembers = permissionRef.current['read:invitation']
      ? await getAllOrganizationPendingMembers({
        organizationId: orgId,
        query: queryStringRef.current,
      })
      : [];
    const totalMemberCountFromServer = acceptedMemberCount + pendingMembers.length;
    page = checkPage(page, totalMemberCountFromServer);

    const startIdx = page * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalMemberCountFromServer);

    if (endIdx <= acceptedMemberCount) {
      // all members in current page are accepted members
      setMembersInCurrentPage(acceptedMembersInCurrentPage);
    } else {
      if (startIdx < acceptedMemberCount) {
        // some members in current page are pending members
        setMembersInCurrentPage([
          ...acceptedMembersInCurrentPage,
          ...pendingMembers.slice(0, endIdx - startIdx - acceptedMembersInCurrentPage.length),
        ]);
      } else {
        // all members in current page are pending members
        setMembersInCurrentPage(pendingMembers.slice(startIdx - acceptedMemberCount, endIdx - acceptedMemberCount));
      }
    }
    setCurrentPage(page);
    setTotalMemberCount(totalMemberCountFromServer);
    setLoading(false);
  }, [totalMemberCount, permissionRef]);

  const queryPrevPage = useCallback(async (orgId: string) => {
    await queryMembers(orgId, currentPage - 1);
  }, [currentPage, queryMembers]);

  const queryNextPage = useCallback(async (orgId: string) => {
    await queryMembers(orgId, currentPage + 1);
  }, [currentPage, queryMembers]);

  const queryFirstPage = useCallback(async (orgId: string) => {
    await queryMembers(orgId, 0);
  }, [queryMembers]);

  const reloadCurrentPage = useCallback(async (orgId: string) => {
    await queryMembers(orgId, currentPage);
  }, [currentPage, queryMembers]);

  // I don't want to set these query functions as dependencies in hooks, so I use ref to store them
  const queryPageFunctionsRef = useRef({
    queryFirstPage,
    queryPrevPage,
    queryNextPage,
    reloadCurrentPage,
  });
  queryPageFunctionsRef.current.queryFirstPage = queryFirstPage;
  queryPageFunctionsRef.current.queryPrevPage = queryPrevPage;
  queryPageFunctionsRef.current.queryNextPage = queryNextPage;

  const lastPageIdx = Math.max(0, Math.ceil(totalMemberCount / PAGE_SIZE) - 1);

  return {
    queryPageFunctionsRef,
    membersInCurrentPage,
    hasNextPage: currentPage < lastPageIdx,
    hasPrevPage: currentPage > 0,
    loading,
    queryStringRef,
    totalMemberCount,
  };
};

function checkPermissionRefType(permissionRef: MutableRefObject<Record<Permission, boolean> | undefined>): permissionRef is MutableRefObject<Record<Permission, boolean>> {
  return Boolean(permissionRef.current);
}

export type Permission =
  | 'own:organization'
  | 'read:organization'
  | 'delete:organization'
  | 'update:organization'
  | 'read:membership'
  | 'delete:membership'
  | 'update:membership'
  | 'read:invitation'
  | 'create:invitation'
  | 'delete:invitation'
  | 'create:enterprise_connection'
  | 'read:enterprise_connection'
  | 'delete:enterprise_connection'
  | 'update:enterprise_connection'
  | 'leave:organization';

export async function getCurrentUserPermissionsInOrg(
  organizationId: string,
): Promise<Record<Permission, boolean>> {
  return insomniaFetch({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/user-permissions`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  });
}

export interface FeatureStatus {
  enabled: boolean;
  reason?: string;
};

export interface OrgFeatures {
  gitSync: FeatureStatus;
  orgBasicRbac: FeatureStatus;
  cloudSync: FeatureStatus;
  localVault: FeatureStatus;
};

export interface Features {
  features: OrgFeatures;
};

async function getOrganizationFeatures(
  organizationId: string,
): Promise<Features> {
  return insomniaFetch<Features>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/features`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to fetch org features');
  });
}

/** Get all roles */
export async function getAllRoles(): Promise<Role[]> {
  return insomniaFetch<Role[]>({
    method: 'GET',
    path: '/v1/organizations/roles',
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to fetch roles');
  });
}

/** Get current user's role in an organization */
export async function getCurrentUserRoleInOrg(organizationId: string): Promise<Role> {
  return insomniaFetch<Role>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/members/${await getAccountId()}/roles`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to fetch member roles');
  });
}

export async function updateInvitationRole(roleId: string, invitationId: string, organizationId: string) {
  return insomniaFetch({
    method: 'PATCH',
    path: `/v1/organizations/${organizationId}/invites/${invitationId}`,
    data: { roles: [roleId] },
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to update organization member roles');
  });
}

async function updateMemberRole(role: string, userId: string, organizationId: string) {
  return insomniaFetch({
    method: 'PUT',
    path: `/v1/organizations/${organizationId}/members/${userId}/roles`,
    data: { roles: [role] },
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to update organization member roles');
  });
}

export interface OrganizationBranding {
  logo_url: string;
  colors: string[];
};

export type OrganizationType = 'personal' | 'team' | 'enterprise';

export interface Metadata {
  organizationType: OrganizationType;
  ownerAccountId?: string;
  description?: string;
};

export interface OrganizationAuth0 {
  id: string;
  name: string;
  display_name: string;
  branding: OrganizationBranding;
  metadata: Metadata;
};

async function getOrganization(
  organizationId: string,
): Promise<OrganizationAuth0> {
  return insomniaFetch<OrganizationAuth0>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to fetch organization');
  });
}

async function deleteMember(organizationId: string, userId: string) {
  return insomniaFetch<OrganizationAuth0>({
    method: 'DELETE',
    path: `/v1/organizations/${organizationId}/members/${userId}`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to remove member from organization');
  });
}

async function revokeOrganizationInvite(organizationId: string, invitationId: string) {
  return insomniaFetch<OrganizationAuth0>({
    method: 'DELETE',
    path: `/v1/organizations/${organizationId}/invites/${invitationId}`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to revoke invitation from organization');
  });
}
