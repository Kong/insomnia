import * as fetch from '../account/fetch';
import * as session from '../account/session';
import * as crypt from '../account/crypt';

export async function syncCreateResourceGroup(parentResourceId, name, encSymmetricKey) {
  return fetch.post(
    '/api/resource_groups',
    {
      parentResourceId,
      name,
      encSymmetricKey,
    },
    session.getCurrentSessionId(),
  );
}

export async function syncGetResourceGroup(id) {
  return fetch.get(`/api/resource_groups/${id}`, session.getCurrentSessionId());
}

export async function syncPull(body) {
  return fetch.post('/sync/pull', body, session.getCurrentSessionId(), true);
}

export async function syncPush(body) {
  return fetch.post('/sync/push', body, session.getCurrentSessionId(), true);
}

export async function syncResetData() {
  return fetch.post('/auth/reset', session.getCurrentSessionId());
}

export async function syncFixDupes(resourceGroupIds) {
  return fetch.post('/sync/fix-dupes', { ids: resourceGroupIds }, session.getCurrentSessionId());
}

export async function unshareWithAllTeams(resourceGroupId) {
  return fetch.put(
    `/api/resource_groups/${resourceGroupId}/unshare`,
    session.getCurrentSessionId(),
  );
}

export async function shareWithTeam(resourceGroupId, teamId) {
  // Ask the server what we need to do to invite the member
  const instructions = await fetch.post(
    `/api/resource_groups/${resourceGroupId}/share-a`,
    {
      teamId,
    },
    session.getCurrentSessionId(),
  );

  const privateKeyJWK = session.getPrivateKey();
  const resourceGroupSymmetricKey = crypt.decryptRSAWithJWK(
    privateKeyJWK,
    instructions.encSymmetricKey,
  );

  // Build the invite data request
  const newKeys = {};
  for (const accountId of Object.keys(instructions.keys)) {
    const accountPublicKeyJWK = JSON.parse(instructions.keys[accountId]);
    newKeys[accountId] = crypt.encryptRSAWithJWK(accountPublicKeyJWK, resourceGroupSymmetricKey);
  }

  // Actually share it with the team
  await fetch.post(
    `/api/resource_groups/${resourceGroupId}/share-b`,
    {
      teamId,
      keys: newKeys,
    },
    session.getCurrentSessionId(),
  );
}
