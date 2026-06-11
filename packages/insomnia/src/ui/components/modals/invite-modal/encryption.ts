import {
  finishAddingCollaborators,
  getMyProjectKeys,
  type MemberProjectKey,
  type ProjectMember,
  reconcileFileKeys,
  startAddingCollaborators,
} from 'insomnia-api';

import { getCurrentSessionId, getPrivateKey } from '../../../../account/session';
import { invariant } from '../../../../utils/invariant';

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

interface CollaboratorInviteKey {
  accountId: string;
  projectId: string;
  encKey: string;
}

interface Invite {
  inviteeEmail: string;
  inviteKeys: InviteKey[];
  inviteeId: string;
}

export async function buildInviteByInstruction(
  instruction: InviteInstruction,
  rawProjectKeys: DecryptedProjectKey[],
): Promise<Invite> {
  let inviteKeys: InviteKey[] = [];
  if (rawProjectKeys?.length) {
    const inviteePublicKey = JSON.parse(instruction.inviteePublicKey);
    inviteKeys = await Promise.all(
      rawProjectKeys.map(async key => {
        const reEncryptedSymmetricKey = await window.main.crypt.encryptRSAWithJWK(inviteePublicKey, key.symmetricKey);
        return {
          projectId: key.projectId,
          encSymmetricKey: reEncryptedSymmetricKey,
          autoLinked: instruction.inviteeAutoLinked,
        };
      }),
    );
  }
  return {
    inviteeId: instruction.inviteeId,
    inviteeEmail: instruction.inviteeEmail,
    inviteKeys,
  };
}

async function buildMemberProjectKey(
  accountId: string,
  projectId: string,
  publicKey: string,
  rawProjectKey?: string,
): Promise<MemberProjectKey | null> {
  if (!rawProjectKey) {
    return null;
  }
  const acctPublicKey = JSON.parse(publicKey);
  const encSymmetricKey = await window.main.crypt.encryptRSAWithJWK(acctPublicKey, rawProjectKey);
  return {
    projectId,
    accountId,
    encSymmetricKey,
  };
}

interface EncryptedProjectKey {
  projectId: string;
  encKey: string;
}
async function decryptProjectKeys(
  decryptionKey: JsonWebKey,
  projectKeys: EncryptedProjectKey[],
): Promise<DecryptedProjectKey[]> {
  const promises = projectKeys.map(async key => {
    const symmetricKey = await window.main.crypt.decryptRSAWithJWK(decryptionKey, key.encKey);
    return {
      projectId: key.projectId,
      symmetricKey,
    };
  });

  const decrypted = await Promise.all(promises);
  return decrypted;
}

interface StartInviteParams {
  teamIds: string[];
  organizationId: string;
  emails: string[];
  roleId: string;
}

interface DecryptedProjectKey {
  projectId: string;
  symmetricKey: string;
}

export async function startInvite({ emails, teamIds, organizationId, roleId }: StartInviteParams) {
  const sessionId = await getCurrentSessionId();
  invariant(sessionId, 'Session ID is required');

  // we are merging these endpoints into one as it has grown onto several types over time.
  // this way, we can also offload the complex logic to the API
  const instruction = await startAddingCollaborators({
    sessionId,
    organizationId,
    emails,
    teamIds,
  });

  const myKeysInfo = await getMyProjectKeys({
    organizationId,
    sessionId,
  });

  let memberKeys: MemberProjectKey[] = [];
  const keyMap: Record<string, string> = {};
  const projectKeys = await decryptProjectKeys(await getPrivateKey(), myKeysInfo.projectKeys || []);

  if (myKeysInfo.members?.length) {
    projectKeys.reduce((keyMap: Record<string, string>, key: DecryptedProjectKey) => {
      keyMap[key.projectId] = key.symmetricKey;
      return keyMap;
    }, keyMap);

    // This is to reconcile any users in bad standing
    memberKeys = (
      await Promise.all(
        myKeysInfo.members.map((member: ProjectMember) =>
          buildMemberProjectKey(member.accountId, member.projectId, member.publicKey, keyMap[member.projectId]),
        ),
      )
    ).filter(Boolean) as MemberProjectKey[];
  }

  if (memberKeys.length) {
    await reconcileFileKeys({
      organizationId,
      memberKeys,
      sessionId,
    });
  }

  const accountIds = Object.keys(instruction);
  // TODO: we should do this not in the renderer process but somewhere else, or do it in a worker instead at least
  // computation is going to be costly when there are lots of project keys.
  const keys: Record<string, Record<string, CollaboratorInviteKey>> = {};

  if (projectKeys.length) {
    for (const acctId in instruction) {
      if (!keys[acctId]) {
        keys[acctId] = {};
      }

      for (const key of projectKeys) {
        const pubKey = instruction[acctId].publicKey;
        const newKey = await buildMemberProjectKey(acctId, key.projectId, pubKey, key.symmetricKey);

        if (newKey) {
          keys[acctId][key.projectId] = {
            accountId: newKey.accountId,
            projectId: newKey.projectId,
            encKey: newKey.encSymmetricKey,
          };
        }
      }
    }
  }
  await finishAddingCollaborators({
    sessionId,
    organizationId,
    teamIds,
    keys,
    accountIds,
    roleId,
  });
}
