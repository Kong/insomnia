import { decryptRSAWithJWK, encryptRSAWithJWK } from '../../../../account/crypt';
import { getCurrentSessionId, getPrivateKey } from '../../../../account/session';
import { invariant } from '../../../../utils/invariant';
import { insomniaFetch } from '../../../insomniaFetch';

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

export function buildInviteByInstruction(
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

interface EncryptedProjectKey {
  projectId: string;
  encKey: string;
}
async function decryptProjectKeys(
  decryptionKey: JsonWebKey,
  projectKeys: EncryptedProjectKey[],
): Promise<DecryptedProjectKey[]> {
  const promises = projectKeys.map(key => {
    const symmetricKey = decryptRSAWithJWK(decryptionKey, key.encKey);
    return {
      projectId: key.projectId,
      symmetricKey,
    };
  });

  const decrypted = await Promise.all(promises);
  return decrypted;
}

export interface StartInviteProgress {
  current: number;
  total: number;
  message: string;
}

interface StartInviteParams {
  teamIds: string[];
  organizationId: string;
  emails: string[];
  roleId: string;
  onProgress?: (progress: StartInviteProgress) => void;
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

interface DecryptedProjectKey {
  projectId: string;
  symmetricKey: string;
}

interface MemberProjectKey {
  accountId: string;
  projectId: string;
  encSymmetricKey: string;
}

interface CollaboratorInstructionItem {
  accountId: string;
  publicKey: string; // stringified JSON WEB KEY
  autoLinked: boolean;
}

type CollaboratorInstruction = Record<string, CollaboratorInstructionItem>;

export async function startInvite({ emails, teamIds, organizationId, roleId, onProgress }: StartInviteParams) {
  const sessionId = await getCurrentSessionId();
  invariant(sessionId, 'Session ID is required');

  onProgress?.({
    current: 0,
    total: 5,
    message: 'Initializing invite process...'
  });

   // TODO remove
  await new Promise(resolve => setTimeout(resolve, 500));

  // we are merging these endpoints into one as it has grown onto several types over time.
  // this way, we can also offload the complex logic to the API
  const instruction = await insomniaFetch<CollaboratorInstruction>({
    method: 'POST',
    path: `/v1/desktop/organizations/${organizationId}/collaborators/start-adding`,
    data: { teamIds, emails },
    sessionId,
    onlyResolveOnSuccess: true,
  });

  onProgress?.({
    current: 1,
    total: 5,
    message: 'Fetching and decrypting project keys...'
  });

   // TODO remove
  await new Promise(resolve => setTimeout(resolve, 500));

  const myKeysInfo = await insomniaFetch<ResponseGetMyProjectKeys>({
    method: 'GET',
    path: `/v1/organizations/${organizationId}/my-project-keys`,
    sessionId,
    onlyResolveOnSuccess: true,
  });

  let memberKeys: MemberProjectKey[] = [];
  const keyMap: Record<string, string> = {};
  const projectKeys = await decryptProjectKeys(await getPrivateKey(), myKeysInfo.projectKeys || []);

  onProgress?.({
    current: 2,
    total: 5,
    message: 'Processing member keys...'
  });

   // TODO remove
  await new Promise(resolve => setTimeout(resolve, 500));

  if (myKeysInfo.members?.length) {
    projectKeys.reduce((keyMap: Record<string, string>, key: DecryptedProjectKey) => {
      keyMap[key.projectId] = key.symmetricKey;
      return keyMap;
    }, keyMap);

    // This is to reconcile any users in bad standing
    memberKeys = myKeysInfo.members
      .map((member: ProjectMember) =>
        buildMemberProjectKey(member.accountId, member.projectId, member.publicKey, keyMap[member.projectId]),
      )
      .filter(Boolean) as MemberProjectKey[];
  }

  if (memberKeys.length) {
    await insomniaFetch({
      method: 'POST',
      path: `/v1/organizations/${organizationId}/reconcile-keys`,
      sessionId,
      data: { keys: memberKeys },
      onlyResolveOnSuccess: true,
    });
  }

  const accountIds = Object.keys(instruction);
  // TODO: we should do this not in the renderer process but somewhere else, or do it in a worker instead at least
  // computation is going to be costly when there are lots of project keys.
  const keys: Record<string, Record<string, CollaboratorInviteKey>> = {};

  if (projectKeys.length) {
    const totalEncryptions = accountIds.length * projectKeys.length;
    let currentEncryption = 0;

    onProgress?.({
      current: 3,
      total: 5,
      message: `Re-encrypting keys (0/${totalEncryptions})...`
    });

    for (const acctId in instruction) {
      if (!keys[acctId]) {
        keys[acctId] = {};
      }

      for (const key of projectKeys) {
        const pubKey = instruction[acctId].publicKey;
        const newKey = buildMemberProjectKey(acctId, key.projectId, pubKey, key.symmetricKey);

        if (newKey) {
          keys[acctId][key.projectId] = {
            accountId: newKey.accountId,
            projectId: newKey.projectId,
            encKey: newKey.encSymmetricKey,
          };
        }

        currentEncryption++;
        onProgress?.({
          current: 3,
          total: 5,
          message: `Re-encrypting keys (${currentEncryption}/${totalEncryptions})...`
        });

        // TODO remove
        if (currentEncryption % 5 === 0 || currentEncryption === totalEncryptions) {
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }
  }

  onProgress?.({
    current: 4,
    total: 5,
    message: 'Finalizing invitations...'
  });

  // TODO remove
  await new Promise(resolve => setTimeout(resolve, 500));

  await insomniaFetch({
    method: 'POST',
    path: `/v1/desktop/organizations/${organizationId}/collaborators/finish-adding`,
    data: { teamIds, keys, accountIds, roleId },
    sessionId,
    onlyResolveOnSuccess: true,
  });

  onProgress?.({
    current: 5,
    total: 5,
    message: 'Invitations sent successfully!'
  });

   // TODO remove
  await new Promise(resolve => setTimeout(resolve, 1000));
}
