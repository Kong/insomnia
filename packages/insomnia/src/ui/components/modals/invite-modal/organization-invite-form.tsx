import React, { useCallback, useState } from 'react';
import { Button, Group, Input, TextField } from 'react-aria-components';
import { useParams } from 'react-router-dom';

import { decryptRSAWithJWK, encryptRSAWithJWK } from '../../../../account/crypt';
import { getCurrentSessionId, getPrivateKey } from '../../../../account/session';
import { SegmentEvent } from '../../../analytics';
import useStateRef from '../../../hooks/use-state-ref';
import { insomniaFetch, ResponseFailError } from '../../../insomniaFetch';
import { Icon } from '../../icon';
import { type PendingMember, updateInvitationRole } from './invite-modal';
import { OrganizationMemberRolesSelector, type Role, SELECTOR_TYPE } from './organization-member-roles-selector';

const defaultRoleName = 'member';

export const InviteForm = ({ onInviteCompleted, allRoles }: {
  onInviteCompleted?: () => void;
  allRoles: Role[];
}) => {
  const selectedRoleRef = React.useRef<Role>(
    allRoles.find(role => role.name === defaultRoleName) as Role,
  );
  const organizationId = useParams().organizationId as string;
  const [inputStr, setInputStr] = useState('');
  const [addedMembers, setAddedMembers, addedMembersRef] = useStateRef<string[]>([]);
  const [errMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  /** Parse input and add email to addMembers list, return false if there are any parsing error. */
  const addMembersFromInput = useCallback<() => boolean>(() => {
    const emailsToAdd = inputStr.trim().split(' ').filter(Boolean);
    const invalidEmails = emailsToAdd.filter(email => isEmailInvalid(email));
    if (invalidEmails.length > 0) {
      setErrorMsg('Invalid email(s):\n' + invalidEmails.join('\n'));
      return false;
    }
    setAddedMembers([...(new Set([...addedMembers, ...emailsToAdd]))]);
    setInputStr('');
    setErrorMsg('');
    return true;
  }, [inputStr, addedMembers, setAddedMembers]);
  const onKeyDownInInput = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if ((event.code === 'Space' || event.code === 'Enter')) {
      event.preventDefault();
      addMembersFromInput();
    }
  }, [addMembersFromInput]);
  return (<>
    <div className="flex justify-between leading-[40px]">
      <Group
        className="min-h-[40px] bg-[--hl-xs] rounded border border-[#4c4c4c] grow relative pr-[81px]"
      >
        <div>
          {addedMembers.length > 0 && (
            <div className="flex flex-wrap justify-start gap-[8px] pl-[12px] py-[8px]">
              {addedMembers.map(email => (
                <div
                  className="leading-[24px] px-[8px] rounded-[15px] bg-[--hl-xs] text-[--color-font]"
                  key={email}
                >
                  {email}
                  <Button
                    onPress={() => {
                      setAddedMembers(addedMembers.filter(addedEmail => addedEmail !== email));
                    }}
                    className="fa fa-times ml-[4px]"
                  />
                </div>
              ))}
            </div>
          )}
          <TextField
            className="block"
            aria-label="Emails Input"
            onChange={value => setInputStr(value)}
            value={inputStr}
            onKeyDown={onKeyDownInInput}
          >
            <Input
              className="block w-full px-[12px]"
              placeholder="Enter emails, separated by space"
            />
          </TextField>
        </div>
        <div className="absolute top-0 right-0 w-[81px] ">
          <OrganizationMemberRolesSelector
            {...{
              type: SELECTOR_TYPE.INVITE,
              availableRoles: allRoles,
              memberRoles: [defaultRoleName],
              isDisabled: loading,
              onRoleChange: async role => {
                selectedRoleRef.current = role;
              },
            }}
          />
        </div>
      </Group>
      <Button
        className="h-[40px] w-[67px] text-center bg-[#4000bf] rounded ml-[16px] disabled:opacity-70  shrink-0 self-end text-[--color-font-surprise]"
        isDisabled={loading}
        onPress={() => {
          if (!addMembersFromInput()) {
            return;
          }
          setLoading(true);
          setErrorMsg('');
          handleInvite({
            emails: addedMembersRef.current,
            organizationId,
            role: selectedRoleRef.current,
          }).then(
            inviteeEmails => {
              window.main.trackSegmentEvent({
                event: SegmentEvent.inviteMember,
                properties: {
                  numberOfInvites: inviteeEmails.length,
                },
              });
              setAddedMembers([...addedMembersRef.current.filter(email => !inviteeEmails.includes(email))]);
              onInviteCompleted?.();
            },
            (error: Error) => {
              setErrorMsg(error.message);
            },
          ).finally(() => {
            setLoading(false);
          });
        }}
      >
        Invite
        {loading && (<Icon icon="spinner" className="animate-spin ml-[4px]" />)}
      </Button>
    </div>
    {errMsg && (
      <p className='text-red-500 my-2 whitespace-pre-wrap break-all'>{errMsg}</p>
    )}
  </>);
};

async function handleInvite({
  emails,
  organizationId,
  role,
}: {
    organizationId: string;
    emails: string[];
    role: Role;
}) {
  const { isAllowed } = await checkIfAllowToInvite({ organizationId, emails });
  if (!isAllowed) {
    throw new Error(needToIncreaseSeatErrMsg);
  }

  const instructResults = await Promise.allSettled(emails.map(email => getInviteInstruction({
    organizationId,
    inviteeEmail: email.toLowerCase(),
  })));

  if (instructResults.find(({ status }) => status === 'rejected')) {
    throw new Error(
      (instructResults.filter(({ status }) => status === 'rejected') as { reason: Error }[])
        .map(({ reason: { message } }) => message)
        .join('\n')
    );
  }

  const instructions = (instructResults as PromiseFulfilledResult<InviteInstruction>[]).map(({ value }) => value);

  // fetchClientData
  const { invites, memberKeys } = await genInvitesAndMemberProjectKeys({
    instructions: instructions,
    organizationId,
  });

  if (invites.length > 0) {
    const inviteeEmails = await inviteAction({
      invites,
      memberKeys,
      organizationId,
    });
    if (role.name !== defaultRoleName) {
      await searchInvitesByInviteeEmailAndChangeRole(inviteeEmails, role.id, organizationId);
    }
    return inviteeEmails;
  } else {
    throw new Error('Invites length is 0');
  }
}

interface CheckIfAllowToInviteResponse {
  isAllowed: boolean;
}

async function checkIfAllowToInvite(
  { organizationId, emails }: { organizationId: string; emails: string[] },
): Promise<CheckIfAllowToInviteResponse> {
  return insomniaFetch<CheckIfAllowToInviteResponse>({
    method: 'POST',
    path: `/v1/organizations/${organizationId}/check-seats`,
    data: { emails },
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(() => {
    throw new Error('Failed to fetch available seats');
  });
}

interface InviteInstructionRequestOptions {
  organizationId: string;
  inviteeEmail: string;
}

interface InviteInstruction {
  inviteKeys: InviteKey[];
  inviteeId: string;
  inviteeEmail: string;
  inviteePublicKey: string;
  inviteeAutoLinked: boolean;
}

interface InviteKey {
  projectId: string;
  encSymmetricKey: string;
  autoLinked: boolean;
}

const NEEDS_TO_UPGRADE_ERROR = 'NEEDS_TO_UPGRADE';
const NEEDS_TO_INCREASE_SEATS_ERROR = 'NEEDS_TO_INCREASE_SEATS';

async function getInviteInstruction(
  {
    organizationId,
    inviteeEmail,
  }: InviteInstructionRequestOptions
): Promise<InviteInstruction> {
  return insomniaFetch<InviteInstruction>({
    method: 'POST',
    path: `/v1/organizations/${organizationId}/invites/instructions`,
    data: { inviteeEmail },
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  }).catch(async error => {
    if (error instanceof ResponseFailError && error.response.headers.get('content-type')?.includes('application/json')) {
      let json;
      try {
        json = await error.response.json();
      } catch (e) {
        throw new Error(`Failed to get invite instruction for ${inviteeEmail}`);
      }
      if (json?.error === NEEDS_TO_UPGRADE_ERROR) {
        throw new Error(
          `You are currently on the Free plan where you can invite as many collaborators as you want only as long as
you don’t have more than one project. Since you have more than one project, you need to upgrade to
Individual or above to continue.`
        );
      }
      if (json?.error === NEEDS_TO_INCREASE_SEATS_ERROR) {
        throw new Error(needToIncreaseSeatErrMsg);
      }
      if (json?.message) {
        throw new Error(json.message);
      }
    }
    throw new Error(`Failed to get invite instruction for ${inviteeEmail}`);
  });
}

interface Invite {
  inviteeEmail: string;
  inviteKeys: InviteKey[];
  inviteeId: string;
}

interface MemberProjectKey {
  accountId: string;
  projectId: string;
  encSymmetricKey: string;
}

interface ProjectKey {
  projectId: string;
  encKey: string;
}

interface ProjectMember {
  accountId: string;
  projectId: string;
  publicKey: string;
}

interface ResponseGetMyProjectKeys {
  projectKeys: ProjectKey[];
  members: ProjectMember[];
}

interface EncryptedProjectKey {
  projectId: string;
  encKey: string;
}
interface DecryptedProjectKey {
  projectId: string;
  symmetricKey: string;
}

async function decryptProjectKeys(
  decryptionKey: JsonWebKey,
  projectKeys: EncryptedProjectKey[],
): Promise<DecryptedProjectKey[]> {
  try {
    const promises = projectKeys.map(key => {
      const symmetricKey = decryptRSAWithJWK(decryptionKey, key.encKey);
      return {
        projectId: key.projectId,
        symmetricKey,
      };
    });

    const decrypted = await Promise.all(promises);
    return decrypted;
  } catch (error) {
    throw error;
  }
}

function buildInviteByInstruction(
  instruction: InviteInstruction,
  rawProjectKeys: DecryptedProjectKey[],
): Invite {
  let inviteKeys: InviteKey[] = [];
  if (rawProjectKeys?.length) {
    const inviteePublicKey = JSON.parse(instruction.inviteePublicKey);
    inviteKeys = rawProjectKeys.map(key => {
      const reEncryptedSymmetricKey = encryptRSAWithJWK(inviteePublicKey, key.symmetricKey);
      return {
        projectId: key.projectId,
        encSymmetricKey: reEncryptedSymmetricKey,
        autoLinked: instruction.inviteeAutoLinked,
      };
    });
  }
  return {
    inviteeId: instruction.inviteeId,
    inviteeEmail: instruction.inviteeEmail,
    inviteKeys,
  };
}

function buildMemberProjectKey(
  accountId: string,
  projectId: string,
  publicKey: string,
  rawProjectKey?: string,
): MemberProjectKey | null {
  if (!rawProjectKey) {
    return null;
  }
  const acctPublicKey = JSON.parse(publicKey);
  const encSymmetricKey = encryptRSAWithJWK(acctPublicKey, rawProjectKey);
  return {
    projectId,
    accountId,
    encSymmetricKey,
  };
}

async function genInvitesAndMemberProjectKeys({
  instructions,
  organizationId,
}: {
  instructions: InviteInstruction[];
  organizationId: string;
}) {
  let invites: Invite[] = [];
  let memberKeys: MemberProjectKey[] = [];

  const projectKeysData = await insomniaFetch<ResponseGetMyProjectKeys>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/my-project-keys`,
    sessionId: await getCurrentSessionId(),
    onlyResolveOnSuccess: true,
  });

  try {
    const projectKeys = await decryptProjectKeys(await getPrivateKey(), projectKeysData.projectKeys || []);
    invites = instructions.map(instruction => buildInviteByInstruction(instruction, projectKeys));

    if (projectKeysData.members?.length) {
      const keyMap = projectKeys.reduce((keyMap: Record<string, string>, key: DecryptedProjectKey) => {
        keyMap[key.projectId] = key.symmetricKey;
        return keyMap;
      }, {});

      memberKeys = projectKeysData.members
        .map((member: ProjectMember) =>
          buildMemberProjectKey(member.accountId, member.projectId, member.publicKey, keyMap[member.projectId]),
        )
        .filter(Boolean) as MemberProjectKey[];
    }
  } catch (err: any) {
    throw new Error(`Error in genInvitesAndMemberProjectKeys: ${err.message}`);
  }

  return { invites, memberKeys };
}

async function inviteAction({
  invites,
  memberKeys,
  organizationId,
}: {
  invites: Invite[];
  memberKeys: MemberProjectKey[];
  organizationId: string;
}) {

  const inviteResults = await Promise.allSettled(
    invites.map(invite => inviteUserToOrganization({ organizationId, ...invite }))
  );

  if (inviteResults.find(({ status }) => status === 'rejected')) {
    throw new Error(
      (inviteResults.filter(({ status }) => status === 'rejected') as { reason: Error }[])
        .map(({ reason: { message } }) => message)
        .join('\n')
    );
  }

  const inviteeEmails = (inviteResults as PromiseFulfilledResult<string>[]).map(({ value: inviteeEmail }) => inviteeEmail);

  if (memberKeys.length) {
    await ensureProjectMemberKeys({ organizationId, memberKeys });
  }

  return inviteeEmails;
}

interface BaseOrganizationRequestOption {
  organizationId: string;
};

type InviteUserToOrganizationOptions = BaseOrganizationRequestOption & Invite;

// Invite a user to an organization
async function inviteUserToOrganization(
  options: InviteUserToOrganizationOptions,
) {
  const { organizationId: id, inviteKeys, inviteeId, inviteeEmail } = options;

  return insomniaFetch({
    method: 'POST',
    path: `/v1/organizations/${id}/invites`,
    sessionId: await getCurrentSessionId(),
    data: { inviteeId, inviteKeys, inviteeEmail },
    onlyResolveOnSuccess: true,
  }).then(
    () => inviteeEmail,
    async error => {
      let errMsg = `Failed to invite ${inviteeEmail}`;
      if (error instanceof ResponseFailError && error.message) {
        errMsg = error.message;
      }
      throw new Error(errMsg);
    }
  );
}

async function ensureProjectMemberKeys(
  options: {
    organizationId: string;
    memberKeys: MemberProjectKey[];
  },
) {
  return insomniaFetch({
    method: 'POST',
    path: `/v1/organizations/${options.organizationId}/reconcile-keys`,
    sessionId: await getCurrentSessionId(),
    data: {
      keys: options.memberKeys,
    },
    onlyResolveOnSuccess: true,
  });
}

/* eslint-disable */
const emailRegex = new RegExp(
  /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
);

function isEmailInvalid(email: string) {
  return !email.match(emailRegex);
}

const needToIncreaseSeatErrMsg = 'Seat count is not enough for new collaborators, please increase your seats and try again.';

/** search invites by invitee emails and then change these invites' role */
async function searchInvitesByInviteeEmailAndChangeRole(
  inviteeEmails: string[],
  roleId: string,
  organizationId: string,
) {
  try {
    let { invitations } = await insomniaFetch<{ invitations: PendingMember[] }>({
      method: 'GET',
      path: `/v1/organizations/${organizationId}/invites`,
      sessionId: await getCurrentSessionId(),
      onlyResolveOnSuccess: true,
    });
    invitations = invitations.filter(invitation => inviteeEmails.includes(invitation.invitee.email));
    await Promise.allSettled(invitations.map(({ id: invitationId }) => updateInvitationRole(
      roleId,
      invitationId,
      organizationId,
    )));
  } catch (error) {}
}
