import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  type Key,
  ListBox,
  ListBoxItem,
  type ListBoxItemProps,
  Popover,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useFetcher, useParams, useSearchParams } from 'react-router';

import { getCurrentSessionId } from '../../../../account/session';
import { debounce } from '../../../../common/misc';
import { SegmentEvent } from '../../../analytics';
import { insomniaFetch } from '../../../insomniaFetch';
import type { CollaboratorSearchLoaderResult } from '../../../routes/invite';
import { Icon } from '../../icon';
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
  onInviteCompleted?: () => void;
}

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

export const InviteForm = ({ allRoles, onInviteCompleted }: EmailsInputProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const organizationId = useParams().organizationId as string;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emails, setEmails] = useState<EmailInput[]>([]);
  const [showResults, setShowResults] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selectedRoleRef = React.useRef<Role>(allRoles.find(role => role.name === defaultRoleName) as Role);

  const collaboratorSearchLoader = useFetcher<CollaboratorSearchLoaderResult>();

  const searchResult = useMemo(() => collaboratorSearchLoader.data || [], [collaboratorSearchLoader.data]);

  useEffect(() => {
    if (searchResult.length > 0) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [searchResult]);

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
      collaboratorSearchLoader.load(
        `/organization/${organizationId}/collaborators-search?query=${encodeURIComponent(query)}`,
      );
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

  return (
    <div className="flex w-full flex-col gap-1">
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
              className="min-h-[24px] grow-[inherit] border-none px-2 py-1 leading-6 outline-none"
              placeholder={emails.length > 0 ? 'Enter more emails...' : 'Enter emails, separated by comma...'}
              onKeyDown={handleInputKeyPress}
              onBlur={handleInputBlur}
              onPaste={handlePaste}
              onChange={e => handleSearch(e.currentTarget.value)}
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
          className="h-[40px] w-[67px] shrink-0 self-end rounded bg-[#4000bf] text-center text-[--color-font-surprise] disabled:opacity-70"
          isDisabled={loading}
          onPress={() => {
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
export interface GroupMemberKey {
  accountId: string;
  organizationId: string;
  projectId: string;
  encKey: string;
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
