import type { AESMessage } from '../account/crypt';
import { database as db } from '../common/database';
import type { BaseModel } from './index';

export interface BaseUserSession {
  accountId: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: AESMessage;
  vaultSalt?: string;
  vaultKey?: string;
}

export interface HashedUserSession {
  hashedAccountId: string;
}

export type UserSession = BaseModel & BaseUserSession & HashedUserSession;
export const name = 'UserSession';
export const type = 'UserSession';
export const prefix = 'usr';
export const canDuplicate = false;
export const canSync = false;

export function init(): BaseUserSession {
  return {
    accountId: '',
    id: '',
    email: '',
    firstName: '',
    lastName: '',
    symmetricKey: {} as JsonWebKey,
    publicKey: {} as JsonWebKey,
    encPrivateKey: {} as AESMessage,
    vaultKey: '',
    vaultSalt: '',
  };
}

export function migrate(doc: UserSession) {
  return doc;
}

export async function all() {
  let userList = await db.find<UserSession>(type);

  if (userList?.length === 0) {
    userList = [await getOrCreate()];
  }

  return userList;
}

async function create() {
  const user = await db.docCreate<UserSession>(type);
  return user;
}

export async function update(user: UserSession, patch: Partial<UserSession>) {
  const updatedUser = await db.docUpdate<UserSession>(user, patch);
  return updatedUser;
}

export async function patch(patch: Partial<UserSession>) {
  const user = await getOrCreate();
  const updatedUser = await db.docUpdate<UserSession>(user, patch);
  return updatedUser;
}

export async function getOrCreate() {
  const result = await db.findOne<UserSession>(type);

  if (!result) {
    return await create();
  }
  return result;
}

export async function get() {
  return getOrCreate();
}
