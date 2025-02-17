import { isAfter } from 'date-fns';
import React, { type FC, type MutableRefObject, useEffect, useRef, useState } from 'react';
import { Button, Dialog, Group, Heading, Input, ListBox, ListBoxItem, Modal, ModalOverlay, TextField } from 'react-aria-components';
import { useFetcher, useParams, useSearchParams } from 'react-router-dom';

import { getAccountId, getCurrentSessionId } from '../../../../account/session';
import { getAppWebsiteBaseURL } from '../../../../common/constants';
import { debounce } from '../../../../common/misc';
import { invariant } from '../../../../utils/invariant';
import { SegmentEvent } from '../../../analytics';
import { insomniaFetch } from '../../../insomniaFetch';
import type { Collaborator, CollaboratorsListLoaderResult } from '../../../routes/invite';
import { PromptButton } from '../../base/prompt-button';
import { Icon } from '../../icon';
import { showAlert } from '..';
import { InviteForm } from './invite-form';
import { OrganizationMemberRolesSelector, type Role, SELECTOR_TYPE } from './organization-member-roles-selector';

export function getSearchParamsString(
  searchParams: URLSearchParams,
  changes: Record<string, string | number | undefined>,
) {
  const newSearchParams = new URLSearchParams(searchParams);

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) {
      newSearchParams.delete(key);
    } else {
      newSearchParams.set(key, String(value));
    }
  }

  return newSearchParams.toString();
}

const ItemsPerPage = 15;

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
  const [searchParams, setSearchParams] = useSearchParams();

  const [queryInputString, setQueryInputString] = useState('');
  const [error, setError] = useState<string | null>(null);

  const collaboratorsListLoader = useFetcher<CollaboratorsListLoaderResult>();

  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 0;

  const total = collaboratorsListLoader.data && 'total' in collaboratorsListLoader?.data && collaboratorsListLoader.data.total || 0;
  const collaboratorListError = collaboratorsListLoader.data && 'error' in collaboratorsListLoader?.data && 'message' in collaboratorsListLoader?.data && collaboratorsListLoader.data?.message as string || null;
  const collaborators = collaboratorsListLoader.data && 'collaborators' in collaboratorsListLoader?.data && collaboratorsListLoader.data?.collaborators || [];

  useEffect(() => {
    if (!collaboratorsListLoader.data && collaboratorsListLoader.state === 'idle') {
      collaboratorsListLoader.load(`/organization/${organizationId}/collaborators?page=0&per_page=${ItemsPerPage}`);
    }
  }, [collaboratorsListLoader, organizationId]);

  const handleSearch = debounce((filter: string) => {
    if (filter.trim() === '') {
      collaboratorsListLoader.load(`/organization/${organizationId}/collaborators?page=0&per_page=${ItemsPerPage}`);
      setSearchParams(getSearchParamsString(searchParams, { page: 0, filter: '' }));
    } else {
      collaboratorsListLoader.load(`/organization/${organizationId}/collaborators?page=0&per_page=${ItemsPerPage}&filter=${encodeURIComponent(filter)}`);
      setSearchParams(getSearchParamsString(searchParams, { page: 0, filter }));
    }
  }, 500);

  const resetCollaboratorsList = () => {
    setQueryInputString('');
    collaboratorsListLoader.load(`/organization/${organizationId}/collaborators?page=0&per_page=${ItemsPerPage}`);
    setSearchParams(getSearchParamsString(searchParams, { page: 0, filter: '' }));
  };

  const resetCurrentPage = () => {
    collaboratorsListLoader.load(`/organization/${organizationId}/collaborators?page=${page}&per_page=${ItemsPerPage}`);
    setSearchParams(getSearchParamsString(searchParams, { page, filter: queryInputString }));
  };

  return (
    <ModalOverlay
      isDismissable={true}
      isOpen={true}
      onOpenChange={setIsOpen}
      className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-[--color-bg] theme--transparent-overlay"
    >
      <Modal className="fixed top-[100px] w-full max-w-[900px] rounded-md border border-solid border-[--hl-sm] p-[32px] h-fit bg-[--color-bg] text-[--color-font] theme--dialog">
        <Dialog className="outline-none relative">
          {({ close }) => (
            <>
              <Heading slot="title" className="text-[22px] leading-[34px] mb-[24px]">
                Invite collaborators
              </Heading>
              <Button onPress={close} className="fa fa-times absolute top-0 right-0 text-xl" />
              {permissionRef.current?.['create:invitation'] && (
                <>
                  <InviteForm
                    onInviteCompleted={() => {
                      if (organizationId) {
                        resetCollaboratorsList();
                      }
                    }}
                    allRoles={allRoles}
                  />
                  <hr className="border my-[24px]" />
                </>
              )}

              <div className='flex justify-between leading-[24px] mb-[16px]'>
                <p>WHO HAS ACCESS ({total})</p>
                <Group
                  className="w-[50%] bg-[--hl-xs] py-[4px] px-[8px] rounded flex items-center gap-2"
                  isDisabled={collaboratorsListLoader.state !== 'idle'}
                >
                  <i
                    className="fa fa-search"
                  />
                  <TextField
                    value={queryInputString}
                    onChange={value => {
                      setQueryInputString(value);
                      handleSearch(value);
                    }}
                    aria-label="Member search query"
                    className="flex-1"
                  >
                    <Input
                      className="w-full"
                      placeholder="Search collaborators"
                    />
                  </TextField>
                  {queryInputString && (
                    <Button onPress={resetCollaboratorsList}>
                      <Icon icon="circle-xmark" className='h-4 w-4' />
                    </Button>
                  )}
                </Group>
              </div>
              {collaboratorListError && <div className='flex items-center justify-center h-[200px]'>
                <p className="text-[12px] text-[--color-danger] first-letter:capitalize">{collaboratorListError}</p>
              </div>}
              {collaborators?.length === 0 && page === 0 ? !collaboratorListError && (
                <div className='flex items-center justify-center h-[200px]'>
                  <p className="text-[14px] text-[--color-font]">{queryInputString ? `No member or team found for the search: "${queryInputString}"` : 'No members or teams'}</p>
                </div>
              ) : (
                  <>
                    <ListBox
                      aria-label="Invitation list"
                      className="flex flex-col gap-1"
                    >
                      {collaborators?.map((member: Collaborator, idx: number) => (
                        <MemberListItem
                          key={member.id}
                          index={idx}
                          organizationId={organizationId}
                          member={member}
                          currentUserAccountId={currentUserAccountId}
                          currentUserRoleInOrg={currentUserRoleInOrg}
                          allRoles={allRoles}
                          isCurrentUserOrganizationOwner={isCurrentUserOrganizationOwner}
                          orgFeatures={orgFeatures}
                          permissionRef={permissionRef}
                          revalidateCurrentUserRoleAndPermissionsInOrg={revalidateCurrentUserRoleAndPermissionsInOrg}
                          onResetCurrentPage={resetCurrentPage}
                          onError={setError}
                        />
                      ))}
                    </ListBox>
                    <PaginationBar
                      isPrevDisabled={page === 0}
                      isNextDisabled={total <= ItemsPerPage || total <= (page + 1) * ItemsPerPage}
                      isHidden={total <= ItemsPerPage && page === 0}
                      onPrevPress={() => {
                        collaboratorsListLoader.load(`/organization/${organizationId}/collaborators?page=${page - 1}&per_page=${ItemsPerPage}`);
                        setSearchParams(getSearchParamsString(searchParams, { page: page - 1 }));
                      }}
                      onNextPress={() => {
                        collaboratorsListLoader.load(`/organization/${organizationId}/collaborators?page=${page + 1}&per_page=${ItemsPerPage}`);
                        setSearchParams(getSearchParamsString(searchParams, { page: page + 1 }));
                      }}
                    />
                    {error && <div className='flex justify-center mt-[16px]'>
                      <p className="text-[12px] text-[--color-danger]">{error}</p>
                    </div>}
                  </>)}
              </>)}
          </Dialog>
        </Modal>
      </ModalOverlay>
    );
  };

const MemberListItem: FC<{
  index: number;
  organizationId: string;
  member: Collaborator;
  currentUserAccountId: string;
  currentUserRoleInOrg: Role;
  allRoles: Role[];
  isCurrentUserOrganizationOwner: boolean;
  orgFeatures: Features;
  permissionRef: MutableRefObject<Record<Permission, boolean>>;
  revalidateCurrentUserRoleAndPermissionsInOrg: (organizationId: string) => Promise<[void, void]>;
  onResetCurrentPage: () => void;
  onError: (error: string | null) => void;
}> = ({
  index,
  organizationId,
  member,
  currentUserAccountId,
  currentUserRoleInOrg,
  allRoles,
  isCurrentUserOrganizationOwner,
  orgFeatures,
  permissionRef,
  revalidateCurrentUserRoleAndPermissionsInOrg,
  onResetCurrentPage,
  onError,
}) => {
    const reinviteCollaboratorFetcher = useFetcher();
    const reinviting = reinviteCollaboratorFetcher.state !== 'idle';

    const updateInvitationRoleFetcher = useFetcher();
    const invitationRoleUpdating = updateInvitationRoleFetcher.state !== 'idle';

    const updateMemberRoleFetcher = useFetcher();
    const memberRoleUpdating = updateMemberRoleFetcher.state !== 'idle';

  const [isFailed, setIsFailed] = useState(false);

    const isAcceptedMember = member.type === 'member';
    const isPendingMember = member.type === 'invite';
  const isGroup = member.type === 'group';

    const textValue = member.name ?? member.metadata.email;
  const isCurrentUser = isAcceptedMember && currentUserAccountId === member.metadata.userId;

  const isPendingInvitationExpired = isPendingMember && member.metadata.expiresAt && isAfter(new Date(), new Date(member.metadata.expiresAt));
  const memberRoleName = allRoles.find((r: Role) => r.id === member.metadata.roleId)?.name ?? 'member';

    useEffect(() => {
      if (updateMemberRoleFetcher.data && 'error' in updateMemberRoleFetcher.data && updateMemberRoleFetcher.state === 'idle') {
        onError(updateMemberRoleFetcher.data.error);
      } else if (updateMemberRoleFetcher.data && updateMemberRoleFetcher.state === 'idle') {
        revalidateCurrentUserRoleAndPermissionsInOrg(organizationId);
        onResetCurrentPage();
      }
    }, [onError, onResetCurrentPage, organizationId, revalidateCurrentUserRoleAndPermissionsInOrg, updateMemberRoleFetcher.data, updateMemberRoleFetcher.state]);

    return (
      <ListBoxItem
        id={isAcceptedMember ? member.metadata.userId : member.id}
        data-testid={`collaborator-test-iteration-${index}`}
        textValue={textValue}
        className='flex justify-between outline-none gap-[16px] leading-[36px] odd:bg-[--hl-xs] px-2 rounded-sm'
      >
        <div className="grow truncate relative flex items-center gap-3">
          <div className="relative w-[24px] h-[24px]">
            <img src={member.picture} alt="member image" className="w-[24px] h-[24px] rounded-full absolute left-0 bottom-0 top-0 m-auto" />
            {member.metadata.groupTotal !== undefined && (
              <div className="absolute -bottom-1 -right-1 flex h-3 w-auto min-w-3 items-center justify-center rounded-full border border-white bg-opacity-100 bg-[rgba(var(--color-danger-rgb),var(--tw-bg-opacity))] text-[--color-font-danger] p-1">
                <p className="text-[9px]">{member.metadata.groupTotal}</p>
              </div>
            )}
          </div>
          <div className='flex items-center gap-2'>
            <span>{textValue}</span>
            {isGroup && <span className="inline-flex items-center rounded-full bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] px-1.5 py-0.5 text-xs font-medium text-[--color-font-surprise] ring-1 ring-inset ring-[rgba(var(--color-surprise-rgb),1)]">Team</span>}
            {isCurrentUser && <span className="inline-flex items-center rounded-full bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] px-1.5 py-0.5 text-xs font-medium text-[--color-font-surprise] ring-1 ring-inset ring-[rgba(var(--color-surprise-rgb),1)]">You</span>}
            {isPendingMember && !isPendingInvitationExpired && <span className="inline-flex items-center rounded-full bg-opacity-100 bg-[rgba(var(--color-warning-rgb),var(--tw-bg-opacity))] px-1.5 py-0.5 text-xs font-medium text-[--color-font-warning] ring-1 ring-inset ring-[rgba(var(--color-warning-rgb),1)]">Invite sent</span>}
            {isPendingMember && isPendingInvitationExpired && <span className="inline-flex items-center rounded-full bg-opacity-100 bg-[rgba(var(--color-danger-rgb),var(--tw-bg-opacity))] px-1.5 py-0.5 text-xs font-medium text-[--color-font-danger] ring-1 ring-inset ring-[rgba(var(--color-danger-rgb),1)]">Expired</span>}
          </div>
        </div>
        <div className='flex items-center gap-2'>
          {member.metadata.invitationId ? (
            <Button
              aria-label="Delete member button"
              isDisabled={reinviting}
              onPress={async () => {
                if (!permissionRef.current['update:membership']) {
                  showAlert({
                    title: 'Permission required',
                    message: 'You don\'t have permission to make this action, please contact the organization owner.',
                  });
                  return;
                }

                if (member.metadata.invitationId) {
                  reinviteCollaboratorFetcher.submit({}, {
                    action: `/organization/${organizationId}/invites/${member.metadata.invitationId}/reinvite`,
                    method: 'POST',
                  });
                }
              }}
              className="flex items-center gap-2 min-w-[75px] py-1 px-2 font-semibold aria-pressed:bg-[--hl-sm] text-[--color-font] transition-all text-sm"
            >
              {reinviting ? (
                <Icon icon="spinner" className='fa-spin fa-1x' />
              ) : (
                <Icon icon="paper-plane" />
              )}
              Resend
            </Button>
          ) : (
            <div className='flex h-[25px] min-w-[75px] cursor-pointer items-center justify-center' />
          )}
          {member.type !== 'group' && (
            <OrganizationMemberRolesSelector
              type={SELECTOR_TYPE.UPDATE}
              availableRoles={allRoles}
              memberRoles={[memberRoleName]}
              userRole={currentUserRoleInOrg}
              isDisabled={isAcceptedMember && memberRoleName === 'owner' || invitationRoleUpdating || memberRoleUpdating}
              isRBACEnabled={Boolean(orgFeatures?.features.orgBasicRbac?.enabled)}
              isUserOrganizationOwner={isCurrentUserOrganizationOwner}
              hasPermissionToChangeRoles={permissionRef.current['update:membership']}
              className="min-w-[88px] flex items-center gap-2 h-6"
              onRoleChange={async role => {
                if (isAcceptedMember) {
                  updateMemberRoleFetcher.submit({
                    roleId: role.id,
                  }, {
                    action: `/organization/${organizationId}/members/${member.metadata.userId}/roles`,
                    method: 'POST',
                  });
                } else {
                  updateInvitationRoleFetcher.submit({
                    roleId: role.id,
                  }, {
                    action: `/organization/${organizationId}/invites/${member.metadata.invitationId}`,
                    method: 'POST',
                  });
                }
              }}
            />
          )}
          {member.type === 'group' && (
            <div className='min-w-[88px] flex justify-center items-center'>
              <Button
                aria-label="Manage collaborators"
                className="min-w-[70px] pressed:bg-opacity-40 flex gap-2 p-1 text-[--color-font-surprise] bg-opacity-100 bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] cursor-pointer items-center justify-center rounded-sm bg-clip-padding outline-none hover:bg-opacity-80 focus-visible:ring-2 focus-visible:ring-white/75 transition-all text-sm"
                onPress={() => {
                  if (!permissionRef.current['own:organization']) {
                    showAlert({
                      title: 'Permission required',
                      message: 'You don\'t have permission to make this action, please contact the organization owner.',
                    });
                    return;
                  }

                  window.main.openInBrowser(
                    `${getAppWebsiteBaseURL()}/app/enterprise/team/${member.metadata.groupId}`,
                  );
                }}
              >
                <Icon icon="users" className="h-3 w-3" />
                <p className="m-0 truncate text-sm font-normal">
                  Manage
                </p>
              </Button>
            </div>
          )}
          <PromptButton
            confirmMessage='Confirm'
            className="flex items-center gap-2 min-w-[85px] py-1 px-2 font-semibold aria-pressed:bg-[--hl-sm] text-[--color-font] transition-all text-sm"
            doneMessage={isFailed ? 'Failed' : isAcceptedMember || isGroup ? 'Removed' : 'Revoked'}
            disabled={memberRoleName === 'owner' || isCurrentUser}
            onClick={() => {
              if (!permissionRef.current['delete:membership']) {
                showAlert({
                  title: 'Permission required',
                  message: 'You don\'t have permission to make this action, please contact the organization owner.',
                });
                return;
              }

              onError(null);
              setIsFailed(false);

              if (isAcceptedMember) {
                deleteMember(organizationId, member.metadata.userId!).then(() => {
                  onResetCurrentPage();
                }).catch(error => {
                  onError(error.message);
                  setIsFailed(true);
                });
              }

              if (isPendingMember && member.metadata.invitationId) {
                revokeOrganizationInvite(organizationId, member.metadata.invitationId).then(() => {
                  onResetCurrentPage();
                }).catch(error => {
                  onError(error.message);
                  setIsFailed(true);
                });
              }

              if (isGroup) {
                unlinkTeam(organizationId, member.id).then(() => {
                  onResetCurrentPage();
                }).catch(error => {
                  onError(error.message);
                  setIsFailed(true);
                });
              }
            }}
          >
            <Icon icon={isAcceptedMember || isGroup ? 'trash' : 'square-minus'} />
            {isAcceptedMember || isGroup ? 'Remove' : 'Revoke'}
          </PromptButton>
        </div>
      </ListBoxItem>
    );
  };

export const defaultPerPage = 10;

interface PaginationBarProps {
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  isHidden?: boolean;
  onPrevPress?: () => void;
  onNextPress?: () => void;
};

const PaginationBar = ({ isNextDisabled, isPrevDisabled, isHidden, onPrevPress, onNextPress }: PaginationBarProps) => {
  if (isHidden) {
    return null;
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex h-[50px] w-full flex-shrink-0 items-center justify-between">
        <Button
          isDisabled={isPrevDisabled}
          aria-label="previous page"
          className="flex h-[25px] items-center justify-center gap-[5px] p-1"
          onPress={onPrevPress}
        >
          <Icon icon="arrow-left" className="h-[12px] w-[12px] text text-[--color-font] disabled:text-[#00000080]" />
          <p className="m-0 text-[12px] font-normal capitalize leading-[15px] text-[--color-font] disabled:text-[#00000080]">Previous</p>
        </Button>
        <Button
          isDisabled={isNextDisabled}
          aria-label="next page"
          className="flex h-[25px] items-center justify-center gap-[5px] p-1"
          onPress={onNextPress}
        >
          <p className="m-0 text-[12px] font-normal capitalize leading-[15px] text-[--color-font] disabled:text-[#00000080]">Next</p>
          <Icon icon="arrow-right" className="h-[12px] w-[12px] text-[--color-font] disabled:text-[#00000080]" />
        </Button>
      </div>
    </div>
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
  const { organizationId } = useParams();
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [currentUserRoleInOrg, setCurrentUserRoleInOrg] = useState<Role | null>(null);
  const [orgFeatures, setOrgFeatures] = useState<Features | null>(null);
  const permissionRef = useRef<Record<Permission, boolean>>();
  const [currentUserAccountId, setCurrentUserAccountId] = useState('');
  const [currentOrgInfo, setCurrentOrgInfo] = useState<OrganizationAuth0 | null>(null);

  const isCurrentUserOrganizationOwner = currentUserAccountId === currentOrgInfo?.metadata?.ownerAccountId;

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
      return (
        <InviteModal
          setIsOpen={setIsOpen}
          organizationId={organizationId}
          allRoles={allRoles}
          currentUserRoleInOrg={currentUserRoleInOrg}
          orgFeatures={orgFeatures}
          permissionRef={permissionRef}
          isCurrentUserOrganizationOwner={isCurrentUserOrganizationOwner}
          currentUserAccountId={currentUserAccountId}
          revalidateCurrentUserRoleAndPermissionsInOrg={revalidateCurrentUserRoleAndPermissionsInOrg}
        />
      );
    } else {
      return null;
    }
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
  return insomniaFetch<void>({
    method: 'DELETE',
    path: `/v1/organizations/${organizationId}/members/${userId}`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(error => {
    throw new Error(error ?? 'Failed to remove member from organization');
  });
}

async function unlinkTeam(organizationId: string, collaboratorId: string) {
  return insomniaFetch<void>({
    method: 'DELETE',
    path: `/v1/desktop/organizations/${organizationId}/collaborators/${collaboratorId}/unlink`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(error => {
    throw new Error(error ?? 'Failed to unlink team from organization');
  });
}

async function revokeOrganizationInvite(organizationId: string, invitationId: string) {
  return insomniaFetch<void>({
    method: 'DELETE',
    path: `/v1/organizations/${organizationId}/invites/${invitationId}`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(error => {
    throw new Error(error ?? 'Failed to revoke invitation from organization');
  });
}
