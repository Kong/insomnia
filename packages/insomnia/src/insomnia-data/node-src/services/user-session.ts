import type { UserSession } from '~/insomnia-data';
import { database as db, models } from '~/insomnia-data';

import { decryptAES } from '../crypt';

const { type } = models.userSession;

export async function get() {
  const result = await db.findOne<UserSession>(type);

  if (!result) {
    const user = await db.docCreate<UserSession>(type);
    return user;
  }
  return result;
}

export async function update(patch: Partial<UserSession>) {
  const user = await get();
  const updatedUser = await db.docUpdate<UserSession>(user, patch);
  return updatedUser;
}

export async function remove() {
  const user = await get();
  await db.remove(user);
}

export async function getPrivateKey() {
  const sessionData = await get();

  if (!sessionData) {
    throw new Error("Can't get private key: session is blank.");
  }

  const { symmetricKey, encPrivateKey } = sessionData;

  if (!symmetricKey || !encPrivateKey) {
    throw new Error("Can't get private key: session is missing keys.");
  }

  const privateKeyStr = decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr) as JsonWebKey;
}
