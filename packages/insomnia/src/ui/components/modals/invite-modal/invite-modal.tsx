import { isAfter } from 'date-fns';
import {
  type Collaborator,
  deleteOrganizationMember,
  type FeatureList,
  getOrganizationDetail,
  getOrganizationFeatures,
  getOrganizationMemberRoles,
  getOrganizationRoles,
  getOrgUserPermissions,
  type Organization,
  type Permission,
  revokeInvitation,
  type Role,
  unlinkCollaborator,
} from 'insomnia-api';
import React, { type FC, type MutableRefObject, useEffect, useRef, useState } from 'react';
import {
  Button,
  Dialog,
  Group,
  Heading,
  Input,
  ListBox,
  ListBoxItem,
  Modal,
  ModalOverlay,
  TextField,
} from 'react-aria-components';
import { useParams, useSearchParams } from 'react-router';

import { getAccountId, getCurrentSessionId } from '~/account/session';
import { getAppWebsiteBaseURL } from '~/common/constants';
import { debounce } from '~/common/misc';
import { useCollaboratorsFetcher } from '~/routes/organization.$organizationId.collaborators';
import { useInviteFetcher } from '~/routes/organization.$organizationId.collaborators.invites.$invitationId';
import { useReinviteFetcher } from '~/routes/organization.$organizationId.collaborators.invites.$invitationId.reinvite';
import { useCollaboratorsCheckSeatsLoaderFetcher } from '~/routes/organization.$organizationId.collaborators-check-seats';
import { useOrganizationMemberRolesActionFetcher } from '~/routes/organization.$organizationId.members.$userId.roles';
import { SegmentEvent } from '~/ui/analytics';
import { PromptButton } from '~/ui/components/base/prompt-button';
import { Icon } from '~/ui/components/icon';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { showModal } from '~/ui/components/modals/index';
import { invariant } from '~/utils/invariant';

import { InviteForm } from './invite-form';
import { OrganizationMemberRolesSelector, SELECTOR_TYPE } from './organization-member-roles-selector';

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
  orgFeatures: FeatureList;
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

  const collaboratorsListLoader = useCollaboratorsFetcher();

  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 0;

  const total =
    (collaboratorsListLoader.data && 'total' in collaboratorsListLoader.data && collaboratorsListLoader.data.total) ||
    0;
  const collaboratorListError =
    (collaboratorsListLoader.data &&
      'error' in collaboratorsListLoader.data &&
      'message' in collaboratorsListLoader.data &&
      (collaboratorsListLoader.data?.message as string)) ||
    null;
  const collaborators =
    (collaboratorsListLoader.data &&
      'collaborators' in collaboratorsListLoader.data &&
      collaboratorsListLoader.data?.collaborators) ||
    [];

  useEffect(() => {
    if (!collaboratorsListLoader.data && collaboratorsListLoader.state === 'idle') {
      collaboratorsListLoader.load({ organizationId, page: 0, per_page: ItemsPerPage });
    }
  }, [collaboratorsListLoader, organizationId]);

  const handleSearch = debounce((filter: string) => {
    if (filter.trim() === '') {
      collaboratorsListLoader.load({ organizationId, page: 0, per_page: ItemsPerPage });
      setSearchParams(getSearchParamsString(searchParams, { page: 0, filter: '' }));
    } else {
      collaboratorsListLoader.load({
        organizationId,
        page: 0,
        per_page: ItemsPerPage,
        filter: encodeURIComponent(filter),
      });
      setSearchParams(getSearchParamsString(searchParams, { page: 0, filter }));
    }
  }, 500);

  const resetCollaboratorsList = () => {
    setQueryInputString('');
    collaboratorsListLoader.load({ organizationId, page: 0, per_page: ItemsPerPage });
    setSearchParams(getSearchParamsString(searchParams, { page: 0, filter: '' }));
  };

  const resetCurrentPage = () => {
    collaboratorsListLoader.load({ organizationId, page, per_page: ItemsPerPage });
    setSearchParams(getSearchParamsString(searchParams, { page, filter: queryInputString }));
  };

  const collaboratorsCheckSeatsLoader = useCollaboratorsCheckSeatsLoaderFetcher();
  const checkSeatsResponseData = collaboratorsCheckSeatsLoader.data;
  const collaboratorsCheckSeatsLoaderLoad = collaboratorsCheckSeatsLoader.load;
  useEffect(() => {
    collaboratorsCheckSeatsLoaderLoad({ organizationId });
  }, [collaboratorsCheckSeatsLoaderLoad, organizationId]);

  return (
    <ModalOverlay
      isDismissable={false}
      isOpen={true}
      onOpenChange={setIsOpen}
      className="theme--transparent-overlay fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-start justify-center bg-(--color-bg) pt-[70px]"
    >
      <Modal className="theme--dialog flex max-h-[calc(var(--visual-viewport-height)-140px)] w-full max-w-[900px] flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-[32px] text-(--color-font)">
        <Dialog className="relative flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-col overflow-hidden">
              <Heading slot="title" className="mb-[24px] text-[22px] leading-[34px]">
                Invite collaborators
              </Heading>
              <Button onPress={close} className="fa fa-times absolute top-0 right-0 text-xl" />
              {permissionRef.current?.['create:invitation'] && (
                <>
                  <InviteForm
                    onInviteCompleted={() => {
                      if (organizationId) {
                        resetCollaboratorsList();
                        collaboratorsCheckSeatsLoaderLoad({ organizationId });
                      }
                    }}
                    senderRole={currentUserRoleInOrg}
                    allRoles={allRoles}
                    checkSeatsResponseData={checkSeatsResponseData}
                  />
                  <hr className="my-[24px]" />
                </>
              )}

              <div className="mb-[16px] flex justify-between leading-[24px]">
                <p>WHO HAS ACCESS ({total})</p>
                <Group
                  className="flex w-[50%] items-center gap-2 rounded-sm bg-(--hl-xs) px-[8px] py-[4px]"
                  isDisabled={collaboratorsListLoader.state !== 'idle'}
                >
                  <i className="fa fa-search" />
                  <TextField
                    value={queryInputString}
                    onChange={value => {
                      setQueryInputString(value);
                      handleSearch(value);
                    }}
                    aria-label="Member search query"
                    className="flex-1"
                  >
                    <Input className="w-full" placeholder="Search collaborators" />
                  </TextField>
                  {queryInputString && (
                    <Button onPress={resetCollaboratorsList}>
                      <Icon icon="circle-xmark" className="h-4 w-4" />
                    </Button>
                  )}
                </Group>
              </div>
              <div className="flex-1 overflow-y-auto">
                {collaboratorListError && (
                  <div className="flex h-[200px] items-center justify-center">
                    <p className="text-[12px] text-(--color-danger) first-letter:capitalize">{collaboratorListError}</p>
                  </div>
                )}
                {collaborators?.length === 0 && page === 0 ? (
                  !collaboratorListError && (
                    <div className="flex h-[200px] items-center justify-center">
                      <p className="text-[14px] text-(--color-font)">
                        {queryInputString
                          ? `No member or team found for the search: "${queryInputString}"`
                          : 'No members or teams'}
                      </p>
                    </div>
                  )
                ) : (
                  <>
                    <ListBox aria-label="Invitation list" className="flex flex-col gap-1">
                      {collaborators?.map((member: Collaborator) => (
                        <MemberListItem
                          key={member.id}
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
                          onRemoveMember={() => {
                            collaboratorsCheckSeatsLoaderLoad({ organizationId });
                          }}
                        />
                      ))}
                    </ListBox>
                    {error && (
                      <div className="mt-[16px] flex justify-center">
                        <p className="text-[12px] text-(--color-danger)">{error}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <PaginationBar
                isPrevDisabled={page === 0}
                isNextDisabled={total <= ItemsPerPage || total <= (page + 1) * ItemsPerPage}
                isHidden={total <= ItemsPerPage && page === 0}
                onPrevPress={() => {
                  collaboratorsListLoader.load({ organizationId, page: page - 1, per_page: ItemsPerPage });
                  setSearchParams(getSearchParamsString(searchParams, { page: page - 1 }));
                }}
                onNextPress={() => {
                  collaboratorsListLoader.load({ organizationId, page: page + 1, per_page: ItemsPerPage });

                  setSearchParams(getSearchParamsString(searchParams, { page: page + 1 }));
                }}
              />
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

const MemberListItem: FC<{
  organizationId: string;
  member: Collaborator;
  currentUserAccountId: string;
  currentUserRoleInOrg: Role;
  allRoles: Role[];
  isCurrentUserOrganizationOwner: boolean;
  orgFeatures: FeatureList;
  permissionRef: MutableRefObject<Record<Permission, boolean>>;
  revalidateCurrentUserRoleAndPermissionsInOrg: (organizationId: string) => Promise<[void, void]>;
  onResetCurrentPage: () => void;
  onError: (error: string | null) => void;
  onRemoveMember: () => void;
}> = ({
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
  onRemoveMember,
}) => {
  const reinviteCollaboratorFetcher = useReinviteFetcher();
  const reinviting = reinviteCollaboratorFetcher.state !== 'idle';

  const updateInvitationRoleFetcher = useInviteFetcher();
  const invitationRoleUpdating = updateInvitationRoleFetcher.state !== 'idle';

  const updateMemberRoleFetcher = useOrganizationMemberRolesActionFetcher();
  const memberRoleUpdating = updateMemberRoleFetcher.state !== 'idle';

  const [isFailed, setIsFailed] = useState(false);

  const isAcceptedMember = member.type === 'member';
  const isPendingMember = member.type === 'invite';
  const isGroup = member.type === 'group';

  const textValue = member.name ?? member.metadata.email;
  const isCurrentUser = isAcceptedMember && currentUserAccountId === member.metadata.userId;

  const isPendingInvitationExpired =
    isPendingMember && member.metadata.expiresAt && isAfter(new Date(), new Date(member.metadata.expiresAt));
  const memberRoleName = allRoles.find((r: Role) => r.id === member.metadata.roleId)?.name ?? 'member';

  useEffect(() => {
    if (
      updateMemberRoleFetcher.data &&
      'error' in updateMemberRoleFetcher.data &&
      updateMemberRoleFetcher.data.error &&
      updateMemberRoleFetcher.state === 'idle'
    ) {
      onError(updateMemberRoleFetcher.data.error);
    } else if (updateMemberRoleFetcher.data && updateMemberRoleFetcher.state === 'idle') {
      revalidateCurrentUserRoleAndPermissionsInOrg(organizationId);
      onResetCurrentPage();
    }
  }, [
    onError,
    onResetCurrentPage,
    organizationId,
    revalidateCurrentUserRoleAndPermissionsInOrg,
    updateMemberRoleFetcher.data,
    updateMemberRoleFetcher.state,
  ]);

  return (
    <ListBoxItem
      id={isAcceptedMember ? member.metadata.userId : member.id}
      textValue={textValue}
      className="flex justify-between gap-[16px] rounded-xs px-2 leading-[36px] outline-hidden odd:bg-(--hl-xs)"
    >
      <div className="relative flex grow items-center gap-3 truncate">
        <div className="relative h-[24px] w-[24px]">
          <img
            src={member.picture}
            alt="member image"
            className="absolute top-0 bottom-0 left-0 m-auto h-[24px] w-[24px] rounded-full"
          />
          {member.metadata.groupTotal !== undefined && (
            <div className="absolute -right-1 -bottom-1 flex h-3 w-auto min-w-3 items-center justify-center rounded-full border border-white bg-(--color-danger) p-1 text-(--color-font-danger)">
              <p className="text-[9px]">{member.metadata.groupTotal}</p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>{textValue}</span>
          {isGroup && (
            <span className="inline-flex items-center rounded-full bg-(--color-surprise) px-1.5 py-0.5 text-xs font-medium text-(--color-font-surprise) ring-1 ring-[rgba(var(--color-surprise-rgb),1)] ring-inset">
              Team
            </span>
          )}
          {isCurrentUser && (
            <span className="inline-flex items-center rounded-full bg-(--color-surprise) px-1.5 py-0.5 text-xs font-medium text-(--color-font-surprise) ring-1 ring-[rgba(var(--color-surprise-rgb),1)] ring-inset">
              You
            </span>
          )}
          {isPendingMember && !isPendingInvitationExpired && (
            <span className="inline-flex items-center rounded-full bg-(--color-warning) px-1.5 py-0.5 text-xs font-medium text-(--color-font-warning) ring-1 ring-[rgba(var(--color-warning-rgb),1)] ring-inset">
              Invite sent
            </span>
          )}
          {isPendingMember && isPendingInvitationExpired && (
            <span className="inline-flex items-center rounded-full bg-(--color-danger) px-1.5 py-0.5 text-xs font-medium text-(--color-font-danger) ring-1 ring-[rgba(var(--color-danger-rgb),1)] ring-inset">
              Expired
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {member.metadata.invitationId ? (
          <Button
            aria-label="Delete member button"
            isDisabled={reinviting}
            onPress={async () => {
              if (!permissionRef.current['update:membership']) {
                showModal(AlertModal, {
                  title: 'Permission required',
                  message: "You don't have permission to make this action, please contact the organization owner.",
                });
                return;
              }

              if (member.metadata.invitationId) {
                reinviteCollaboratorFetcher.submit({
                  organizationId,
                  invitationId: member.metadata.invitationId,
                });
                window.main.trackSegmentEvent({ event: SegmentEvent.inviteResent });
              }
            }}
            className="flex min-w-[75px] items-center gap-2 px-2 py-1 text-sm font-semibold text-(--color-font) transition-all aria-pressed:bg-(--hl-sm)"
          >
            {reinviting ? <Icon icon="spinner" className="fa-spin fa-1x" /> : <Icon icon="paper-plane" />}
            Resend
          </Button>
        ) : (
          <div className="flex h-[25px] min-w-[75px] cursor-pointer items-center justify-center" />
        )}
        {member.type !== 'group' && (
          <OrganizationMemberRolesSelector
            type={SELECTOR_TYPE.UPDATE}
            availableRoles={allRoles}
            memberRoles={[memberRoleName]}
            userRole={currentUserRoleInOrg}
            isDisabled={
              (isAcceptedMember && memberRoleName === 'owner') || invitationRoleUpdating || memberRoleUpdating
            }
            isRBACEnabled={Boolean(orgFeatures?.orgBasicRbac?.enabled)}
            isUserOrganizationOwner={isCurrentUserOrganizationOwner}
            hasPermissionToChangeRoles={permissionRef.current['update:membership']}
            className="flex h-6 min-w-[88px] items-center gap-2"
            onRoleChange={async role => {
              if (isAcceptedMember) {
                updateMemberRoleFetcher.submit({
                  roleId: role.id,
                  organizationId,
                  userId: member.metadata.userId!,
                });
              } else {
                member.metadata.invitationId &&
                  updateInvitationRoleFetcher.submit({
                    organizationId,
                    invitationId: member.metadata.invitationId,
                    roleId: role.id,
                  });
              }
            }}
          />
        )}
        {member.type === 'group' && (
          <div className="flex min-w-[88px] items-center justify-center">
            <Button
              aria-label="Manage collaborators"
              className="flex min-w-[70px] cursor-pointer items-center justify-center gap-2 rounded-xs bg-(--color-surprise) bg-clip-padding p-1 text-sm text-(--color-font-surprise) outline-hidden transition-all hover:bg-(--color-surprise)/80 focus-visible:ring-2 focus-visible:ring-white/75 data-pressed:bg-(--color-surprise)/40"
              onPress={() => {
                if (!permissionRef.current['own:organization']) {
                  showModal(AlertModal, {
                    title: 'Permission required',
                    message: "You don't have permission to make this action, please contact the organization owner.",
                  });
                  return;
                }

                window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/enterprise/team/${member.metadata.groupId}`);
              }}
            >
              <Icon icon="users" className="h-3 w-3" />
              <p className="m-0 truncate text-sm font-normal">Manage</p>
            </Button>
          </div>
        )}
        <PromptButton
          confirmMessage="Confirm"
          ariaLabel={isAcceptedMember || isGroup ? 'Remove' : 'Revoke'}
          className="flex min-w-[85px] items-center gap-2 px-2 py-1 text-sm font-semibold text-(--color-font) transition-all aria-pressed:bg-(--hl-sm)"
          doneMessage={isFailed ? 'Failed' : isAcceptedMember || isGroup ? 'Removed' : 'Revoked'}
          disabled={memberRoleName === 'owner' || isCurrentUser}
          onClick={async () => {
            if (isPendingMember && member.metadata.invitationId) {
              if (!permissionRef.current['delete:invitation']) {
                showModal(AlertModal, {
                  title: 'Permission required',
                  message: "You don't have permission to make this action, please contact the organization owner.",
                });
                return;
              }
            } else if (!permissionRef.current['delete:membership']) {
              showModal(AlertModal, {
                title: 'Permission required',
                message: "You don't have permission to make this action, please contact the organization owner.",
              });
              return;
            }

            onError(null);
            setIsFailed(false);

            if (isAcceptedMember) {
              deleteOrganizationMember({
                organizationId,
                userId: member.metadata.userId!,
                sessionId: await getCurrentSessionId(),
              })
                .then(() => {
                  onResetCurrentPage();
                  onRemoveMember();
                })
                .catch(error => {
                  onError(error.message);
                  setIsFailed(true);
                });
            }

            if (isPendingMember && member.metadata.invitationId) {
              revokeOrganizationInvite(organizationId, member.metadata.invitationId)
                .then(() => {
                  onResetCurrentPage();
                  onRemoveMember();
                  window.main.trackSegmentEvent({ event: SegmentEvent.inviteRevoked });
                })
                .catch(error => {
                  onError(error.message);
                  setIsFailed(true);
                });
            }

            if (isGroup) {
              unlinkTeam(organizationId, member.id)
                .then(() => {
                  onResetCurrentPage();
                  onRemoveMember();
                })
                .catch(error => {
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

interface PaginationBarProps {
  isPrevDisabled?: boolean;
  isNextDisabled?: boolean;
  isHidden?: boolean;
  onPrevPress?: () => void;
  onNextPress?: () => void;
}

const PaginationBar = ({ isNextDisabled, isPrevDisabled, isHidden, onPrevPress, onNextPress }: PaginationBarProps) => {
  if (isHidden) {
    return null;
  }

  return (
    <div className="flex flex-col items-end">
      <div className="flex h-[50px] w-full shrink-0 items-center justify-between">
        <Button
          isDisabled={isPrevDisabled}
          aria-label="previous page"
          className="flex h-[25px] items-center justify-center gap-[5px] p-1"
          onPress={onPrevPress}
        >
          <Icon icon="arrow-left" className="text h-[12px] w-[12px] text-(--color-font) disabled:text-[#00000080]" />
          <p className="m-0 text-[12px] leading-[15px] font-normal text-(--color-font) capitalize disabled:text-[#00000080]">
            Previous
          </p>
        </Button>
        <Button
          isDisabled={isNextDisabled}
          aria-label="next page"
          className="flex h-[25px] items-center justify-center gap-[5px] p-1"
          onPress={onNextPress}
        >
          <p className="m-0 text-[12px] leading-[15px] font-normal text-(--color-font) capitalize disabled:text-[#00000080]">
            Next
          </p>
          <Icon icon="arrow-right" className="h-[12px] w-[12px] text-(--color-font) disabled:text-[#00000080]" />
        </Button>
      </div>
    </div>
  );
};

// supply information about current org to InviteModal
export const InviteModalContainer: FC<{
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}> = ({ isOpen, setIsOpen }) => {
  const [loadingOrgInfo, setLoadingOrgInfo] = useState(true);
  const { organizationId } = useParams();
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [currentUserRoleInOrg, setCurrentUserRoleInOrg] = useState<Role | null>(null);
  const [orgFeatures, setOrgFeatures] = useState<FeatureList | null>(null);
  const permissionRef = useRef<Record<Permission, boolean>>();
  const [currentUserAccountId, setCurrentUserAccountId] = useState('');
  const [currentOrgInfo, setCurrentOrgInfo] = useState<Organization | null>(null);

  const isCurrentUserOrganizationOwner = currentUserAccountId === currentOrgInfo?.metadata?.ownerAccountId;

  async function getBaseInfo(organizationId: string) {
    const sessionId = await getCurrentSessionId();
    return Promise.all([
      getCurrentUserRoleInOrg(organizationId).then(setCurrentUserRoleInOrg),
      getOrganizationFeatures({
        organizationId,
        sessionId,
      }).then(res => setOrgFeatures(res?.features)),
      getOrgUserPermissions({
        organizationId,
        sessionId,
      }).then(permissions => {
        permissionRef.current = permissions;
      }),
      getAccountId().then(setCurrentUserAccountId),
      getOrganizationDetail({
        organizationId,
        sessionId,
      }).then(setCurrentOrgInfo),
    ]);
  }

  async function revalidateCurrentUserRoleAndPermissionsInOrg(organizationId: string) {
    return Promise.all([
      getCurrentUserRoleInOrg(organizationId).then(setCurrentUserRoleInOrg),
      getOrgUserPermissions({
        organizationId,
        sessionId: await getCurrentSessionId(),
      }).then(permissions => {
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
          getOrganizationRoles({ sessionId: await getCurrentSessionId() }).then(setAllRoles),
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
  }, [isOpen]);

  if (loadingOrgInfo || !organizationId || !isOpen) {
    return null;
  }
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
  }
  return null;
};

function checkPermissionRefType(
  permissionRef: MutableRefObject<Record<Permission, boolean> | undefined>,
): permissionRef is MutableRefObject<Record<Permission, boolean>> {
  return Boolean(permissionRef.current);
}

/** Get current user's role in an organization */
export async function getCurrentUserRoleInOrg(organizationId: string): Promise<Role> {
  return getOrganizationMemberRoles({
    organizationId,
    sessionId: await getCurrentSessionId(),
    userId: await getAccountId(),
  }).catch(() => {
    throw new Error('Failed to fetch member roles');
  });
}

export interface OrganizationBranding {
  logo_url: string;
  colors: string[];
}

async function unlinkTeam(organizationId: string, collaboratorId: string) {
  try {
    return await unlinkCollaborator({
      organizationId,
      collaboratorId,
      sessionId: await getCurrentSessionId(),
    });
  } catch (error) {
    throw new Error(error ?? 'Failed to unlink team from organization');
  }
}

async function revokeOrganizationInvite(organizationId: string, invitationId: string) {
  try {
    return revokeInvitation({
      organizationId,
      invitationId,
      sessionId: await getCurrentSessionId(),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to revoke invitation from organization');
  }
}
