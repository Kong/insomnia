import { runVcsGraphQL } from 'insomnia-api';
import type { UserSession } from 'insomnia-data';
import { services } from 'insomnia-data';

import * as crypt from './crypt';

// TODO: This is a temporary solution to get the private key from the session.
export async function getPrivateKey(sessionData?: UserSession): Promise<JsonWebKey> {
  if (!sessionData) {
    throw new Error("Can't get private key: session is blank.");
  }

  const { symmetricKey, encPrivateKey } = sessionData;

  if (!symmetricKey || !encPrivateKey) {
    throw new Error("Can't get private key: session is missing keys.");
  }

  const privateKeyStr = await crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr) as JsonWebKey;
}

export async function assertSession() {
  const sessionData = await services.userSession.get();
  const { accountId, id, publicKey, symmetricKey } = sessionData;
  const privateKey = await getPrivateKey(sessionData);

  if (!id) {
    throw new Error('Not logged in');
  }

  return {
    accountId,
    sessionId: id,
    privateKey,
    publicKey,
    symmetricKey,
  };
}

export async function runGraphQL<T>(query: string, variables: Record<string, any>, name: string): Promise<T> {
  const { sessionId } = await assertSession();
  const { data, errors } = await runVcsGraphQL<T>({
    query,
    variables,
    sessionId,
    name,
  });

  if (errors && errors.length) {
    console.log(`[sync] Failed to query ${name}`, errors);
    throw new Error(`Failed to query ${name}: ${errors[0].message}`);
  }

  if (data == null) {
    throw new Error(`Failed to query ${name}: no data returned`);
  }

  return data;
}
