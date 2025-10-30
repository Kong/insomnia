import classNames from 'classnames';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Heading,
  type Key,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  Popover,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useParams, useSearchParams } from 'react-router';

import { getAppWebsiteBaseURL } from '~/common/constants';
import { docsPricingLearnMoreLink } from '~/common/documentation';
import { debounce } from '~/common/misc';
import { isOwnerOfOrganization } from '~/models/organization';
import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import {
  type CheckSeatsResponse,
  needsToIncreaseSeats,
  needsToUpgrade,
} from '~/routes/organization.$organizationId.collaborators-check-seats';
import { useCollaboratorsSearchLoaderFetcher } from '~/routes/organization.$organizationId.collaborators-search';
import { SegmentEvent } from '~/ui/analytics';
import { Icon } from '~/ui/components/icon';
import { useIsLightTheme } from '~/ui/hooks/theme';
import { insomniaFetch } from '~/ui/insomniaFetch';

import { startInvite } from './encryption';
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

interface EmailsInputProps {
  allRoles: Role[];
  senderRole: Role;
  onInviteCompleted?: () => void;
}

const upgradeModalWording = {
  [needsToUpgrade]: {
    ownerTitle: 'Upgrade plan to invite more people',
    memberTitle: 'Ask plan owner to upgrade to invite more people',
    ownerDescription: (
      <>
        Your Essentials plan contains Git Sync projects, so you can only collaborate with up to 3 members. Upgrade to
        collaborate with unlimited users.{' '}
        <a href={docsPricingLearnMoreLink} className="underline">
          Learn more ↗
        </a>
      </>
    ),
    memberDescription: (
      <>
        Your Essentials plan contains Git Sync projects, so you can only collaborate with up to 3 members. Contact your
        plan owner to upgrade your team's plan to collaborate with more people.{' '}
        <a href={docsPricingLearnMoreLink} className="underline">
          Learn more ↗
        </a>
      </>
    ),
    submitText: 'Upgrade',
    submitLink: getAppWebsiteBaseURL() + '/app/pricing',
  },
  [needsToIncreaseSeats]: {
    ownerTitle: 'Increase plan seats to invite more people',
    memberTitle: 'Your team is full',
    ownerDescription: (
      <>
        Your team has reached your plan's total purchased seats. Increase your plan's number of seats to continue
        inviting new people.{' '}
        <a href={docsPricingLearnMoreLink} className="underline">
          Learn more ↗
        </a>
      </>
    ),
    memberDescription: (
      <>
        Your team has reached your plan's total purchased seats. Tell your plan's owner to increase the number of seats
        to continue inviting new people.{' '}
        <a href={docsPricingLearnMoreLink} className="underline">
          Learn more ↗
        </a>
      </>
    ),
    submitText: 'Increase seats',
    submitLink: getAppWebsiteBaseURL() + '/app/pricing',
  },
};

export interface EmailInput {
  email: string;
  isValid: boolean;
  picture?: string;
  teamId?: string;
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  );

  return emailRegex.test(email);
};

const defaultRoleName = 'member';

export const InviteForm = ({
  allRoles,
  onInviteCompleted,
  senderRole,
  checkSeatsResponseData,
}: EmailsInputProps & { checkSeatsResponseData: CheckSeatsResponse | undefined }) => {
  const organizationId = useParams().organizationId as string;
  const [searchParams, setSearchParams] = useSearchParams();

  const { userSession } = useRootLoaderData()!;
  const organizationData = useOrganizationLoaderData();
  const organization = organizationData?.organizations.find(o => o.id === organizationId);
  const isUserOwner =
    organization && userSession.accountId && isOwnerOfOrganization({ organization, accountId: userSession.accountId });
  const sessionId = userSession.id;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emails, setEmails] = useState<EmailInput[]>([]);
  const [showResults, setShowResults] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedRoleRef = React.useRef<Role>(allRoles.find(role => role.name === defaultRoleName) as Role);

  const collaboratorSearchLoader = useCollaboratorsSearchLoaderFetcher();
  let upgradeBannerStatus: 'closed' | typeof needsToUpgrade | typeof needsToIncreaseSeats = 'closed';
  if (checkSeatsResponseData && !checkSeatsResponseData.isAllowed) {
    if (checkSeatsResponseData.code === needsToUpgrade) {
      upgradeBannerStatus = needsToUpgrade;
    } else if (checkSeatsResponseData.code === needsToIncreaseSeats) {
      upgradeBannerStatus = needsToIncreaseSeats;
    }
  }

  const searchResult = useMemo(() => collaboratorSearchLoader.data || [], [collaboratorSearchLoader.data]);

  useEffect(() => {
    setShowResults(searchResult.length > 0);
  }, [searchResult]);

  useEffect(() => {
    const checkSeats = async () => {
      const validEmails = emails.filter(e => e.isValid);
      if (validEmails.length === 0) {
        setError('');
      } else {
        const data = await insomniaFetch<CheckSeatsResponse>({
          method: 'POST',
          path: `/v1/organizations/${organizationId}/check-seats`,
          data: { emails: validEmails.map(e => e.email) },
          sessionId,
        });
        setError(data.isAllowed ? '' : 'You cannot invite more people than the seats you have remaining');
      }
    };
    checkSeats();
  }, [emails, organizationId, sessionId]);

  const addEmail = ({
    email,
    teamId,
    picture = 'https://static.insomnia.rest/insomnia-gorilla.png',
  }: {
    email: string;
    teamId?: string;
    picture?: string;
  }) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return;
    }

    if (emails.map(e => e.email).includes(trimmedEmail)) {
      // If the email is already in the list, move it to the end
      const emailToMove = emails.find(e => e.email === trimmedEmail);
      const updatedEmails = emails.filter(e => e.email !== trimmedEmail);
      setEmails([...updatedEmails, emailToMove as EmailInput]);
    } else if (!isValidEmail(trimmedEmail) && !teamId) {
      setEmails((prev: EmailInput[]) => [...prev, { email: trimmedEmail, isValid: false, teamId, picture }]);
    } else {
      setEmails((prev: EmailInput[]) => [...prev, { email: trimmedEmail, isValid: true, teamId, picture }]);
    }
  };

  const removeEmail = (emailToRemove: string) => {
    setEmails((prev: EmailInput[]) => prev.filter(({ email }: EmailInput) => email !== emailToRemove));
  };

  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();

      if (inputRef.current) {
        addEmail({ email: inputRef.current.value });
        inputRef.current.value = '';
      }
    }
  };

  const handleSearch = debounce((query: string) => {
    if (query.trim() !== '') {
      collaboratorSearchLoader.load({ organizationId, query });
      setSearchParams(getSearchParamsString(searchParams, { query }));
    }
  }, 500);

  const handleInputBlur = () => {
    if (inputRef.current && !showResults) {
      addEmail({ email: inputRef.current.value });
      inputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();

    const pastedText = e.clipboardData.getData('text');
    const emailsArray = pastedText.split(',');

    emailsArray.forEach((email: string) => addEmail({ email }));

    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const isLightTheme = useIsLightTheme();

  return (
    <div className="flex w-full flex-col gap-1">
      {upgradeBannerStatus !== 'closed' && (
        <div
          className={classNames('mb-5 mt-3 flex items-start justify-start gap-5 rounded-md px-6 py-5', {
            'bg-[#292535]': !isLightTheme,
            'bg-[#EEEBFF]': isLightTheme,
          })}
        >
          <Icon icon="circle-info" className="pt-1.5" />
          <div className="flex flex-col items-start justify-start gap-3.5">
            <Heading className="text-lg font-bold">
              {isUserOwner
                ? upgradeModalWording[upgradeBannerStatus].ownerTitle
                : upgradeModalWording[upgradeBannerStatus].memberTitle}
            </Heading>
            <p>
              {isUserOwner
                ? upgradeModalWording[upgradeBannerStatus].ownerDescription
                : upgradeModalWording[upgradeBannerStatus].memberDescription}
            </p>
            {isUserOwner && (
              <a
                href={upgradeModalWording[upgradeBannerStatus].submitLink}
                className="rounded-sm border border-solid border-[--hl-md] px-3 py-2 text-[--color-font] transition-colors hover:bg-opacity-90 hover:no-underline"
              >
                {upgradeModalWording[upgradeBannerStatus].submitText}
              </a>
            )}
          </div>
        </div>
      )}
      <div className="flex w-full items-center gap-4">
        <div
          className="flex flex-1 justify-between gap-3 rounded-md border border-[#4c4c4c] bg-[--hl-xs] p-2"
          ref={triggerRef}
        >
          <div
            className="flex max-h-[200px] flex-1 flex-wrap items-center gap-3 overflow-y-auto"
            onClick={() => inputRef.current?.focus()}
          >
            {emails.map(({ picture, email, isValid }: EmailInput) => (
              <span
                key={email}
                className={`flex h-7 items-center gap-2 rounded-full bg-[--hl-xs] pl-1 pr-2 text-sm leading-6 text-[--color-font] ${isValid ? 'bg-[--hl-xs]' : 'border border-dashed border-orange-400 bg-orange-400 bg-opacity-40'}`}
              >
                <TooltipTrigger delay={0}>
                  <Button
                    className="flex items-center gap-1"
                    onPress={() => {
                      if (inputRef.current) {
                        inputRef.current.value = email;
                        removeEmail(email);
                        handleSearch(email);
                        inputRef.current.focus();
                      }
                    }}
                  >
                    <img src={picture} alt="member image" className="h-5 w-5 rounded-full" />
                    <span className="flex h-full items-center">{`${email} ${isValid ? '' : '(Invalid)'}`}</span>
                  </Button>
                  <Tooltip
                    offset={8}
                    placement="top"
                    className="max-h-[85vh] max-w-xs select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] px-4 py-2 text-sm text-[--color-font] shadow-lg focus:outline-none"
                  >
                    Click to edit
                  </Tooltip>
                </TooltipTrigger>
                <Button
                  className="flex h-full w-4 items-center justify-center"
                  onPress={() => {
                    setError('');
                    removeEmail(email);
                  }}
                >
                  <Icon icon="xmark" className="h-4 w-4 cursor-default text-[--color-font]" />
                </Button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              className="min-h-[24px] grow-[inherit] border-none px-2 py-1 leading-6 outline-none disabled:cursor-not-allowed"
              placeholder={emails.length > 0 ? 'Enter more emails...' : 'Enter emails, separated by comma...'}
              onKeyDown={handleInputKeyPress}
              onBlur={handleInputBlur}
              onPaste={handlePaste}
              onChange={e => handleSearch(e.currentTarget.value)}
              disabled={checkSeatsResponseData && !checkSeatsResponseData.isAllowed}
            />
          </div>
          <div className="flex w-[81px] items-center">
            <OrganizationMemberRolesSelector
              type={SELECTOR_TYPE.INVITE}
              availableRoles={allRoles}
              memberRoles={[defaultRoleName]}
              isDisabled={false}
              onRoleChange={async role => {
                selectedRoleRef.current = role;
              }}
            />
          </div>
        </div>
        <Button
          className="h-[40px] w-[67px] shrink-0 self-end rounded bg-[#4000bf] text-center text-[--color-font-surprise] disabled:cursor-not-allowed disabled:opacity-70"
          isDisabled={loading || (checkSeatsResponseData && !checkSeatsResponseData.isAllowed)}
          onPress={async () => {
            if (emails.some(({ isValid }) => !isValid)) {
              setError('Some emails are invalid, please correct them before inviting.');
              return;
            }

            setLoading(true);
            setError('');

            // Split emails into groups and individual emails
            const emailsToInvite = emails.filter(({ teamId }) => !teamId).map(({ email }) => email);
            const groupsToInvite = emails.filter(({ teamId }) => teamId).map(({ teamId }) => teamId as string);

            startInvite({
              emails: emailsToInvite,
              teamIds: groupsToInvite,
              organizationId,
              roleId: selectedRoleRef.current.id,
            })
              .then(
                () => {
                  window.main.trackSegmentEvent({
                    event: SegmentEvent.inviteMember,
                    properties: {
                      numberOfInvites: emailsToInvite.length,
                      numberOfTeams: groupsToInvite.length,
                      receiver_role: selectedRoleRef.current.name,
                      sender_role: senderRole.name,
                    },
                  });

                  setEmails([]);
                  onInviteCompleted?.();
                },
                (error: Error) => {
                  setError(error.message);
                },
              )
              .finally(() => {
                setLoading(false);
              });
          }}
        >
          Invite
          {loading && <Icon icon="spinner" className="ml-[4px] animate-spin" />}
        </Button>
        <Popover
          placement="bottom start"
          className="w-[--trigger-width] min-w-[650px] rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] shadow-md"
          ref={popoverRef}
          triggerRef={triggerRef}
          isOpen={showResults}
          onOpenChange={setShowResults}
        >
          <ListBox
            className="p-1 outline-none"
            selectionMode="single"
            aria-label="Organization members"
            onAction={(email: Key) => {
              const exists = emails.findIndex(({ email: e }) => e === email) !== -1;

              if (exists) {
                setEmails((prev: EmailInput[]) => prev.filter(({ email: e }) => e !== email));
              } else {
                const selectedItem = searchResult.find(item => item.name === email);

                addEmail({
                  email: email.toString(),
                  teamId: selectedItem?.type === 'group' ? selectedItem?.id : undefined,
                  picture: selectedItem?.picture,
                });
              }

              if (inputRef.current) {
                inputRef.current.value = '';
              }
            }}
          >
            {searchResult.map(item => (
              <UserItem
                id={item.name}
                key={item.name}
                textValue={item.name}
                isSelected={emails.findIndex(({ email: e }) => e === item.name) !== -1}
              >
                <img alt="" src={item.picture} className="h-6 w-6 rounded-full" />
                <span className="truncate">{item.name}</span>
              </UserItem>
            ))}
          </ListBox>
        </Popover>
      </div>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

const UserItem = (props: ListBoxItemProps & { children: React.ReactNode; isSelected: boolean }) => {
  return (
    <ListBoxItem
      {...props}
      className="group flex cursor-pointer select-none items-center gap-2 rounded px-1 py-1 outline-none hover:bg-[--hl-xs] hover:text-[--color-font] focus:bg-[--hl-xs] focus:text-[--color-font]"
    >
      <span className="group-selected:font-medium flex flex-1 items-center gap-3 truncate font-normal">
        {props.children}
      </span>
      {props.isSelected && <Icon icon="check" className="text-primary h-4 w-4" />}
    </ListBoxItem>
  );
};
