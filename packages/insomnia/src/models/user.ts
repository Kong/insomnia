import type { AESMessage } from '../account/crypt';
import { database as db } from '../common/database';
import type { BaseModel } from './index';

export interface BaseUser {
  accountId: string;
  id: string;
  sessionExpiry: Date | null;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: AESMessage;
};

export type User = BaseModel & BaseUser;
export const name = 'User';
export const type = 'User';
export const prefix = 'usr';
export const canDuplicate = false;
export const canSync = false;

export function init(): BaseUser {
  return {
    accountId: '',
    id: '',
    sessionExpiry: null,
    email: '',
    firstName: '',
    lastName: '',
    symmetricKey: {} as JsonWebKey,
    publicKey: {} as JsonWebKey,
    encPrivateKey: {} as AESMessage,
  };
}

export function migrate(doc: User) {
  return doc;
}

export async function all() {
  let userList = await db.all<User>(type);

  if (userList?.length === 0) {
    userList = [await getOrCreate()];
  }

  return userList;
}

async function create() {
  const user = await db.docCreate<User>(type);
  return user;
}

export async function update(user: User, patch: Partial<User>) {
  const updatedUser = await db.docUpdate<User>(user, patch);
  return updatedUser;
}

export async function patch(patch: Partial<User>) {
  const user = await getOrCreate();
  const updatedUser = await db.docUpdate<User>(user, patch);
  return updatedUser;
}

export async function getOrCreate() {
  const results = await db.all<User>(type) || [];

  if (results.length === 0) {
    return await create();
  }
  return results[0];
}

export async function get() {
  const results = await db.all<User>(type) || [];

  return results[0];
}
