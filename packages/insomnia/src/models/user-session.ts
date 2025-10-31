import type { AESMessage } from '../account/crypt';
import { database as db } from '../common/database';
import type { BaseModel } from './index';

const encryptionPrefix = 'encrypted_v1_';
// deterministicStringify

async function isomorphicEncryptString(raw: string) {
  if (process.type === 'renderer') {
    return await window.main.secretStorage.encryptString(raw);
  }
  const { safeStorage } = await import('electron');
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(raw).toString('hex');
  }
  return raw;
}

async function isomorphicDecryptString(cipherText: string) {
  if (process.type === 'renderer') {
    return await window.main.secretStorage.decryptString(cipherText);
  }
  const { safeStorage } = await import('electron');
  const buffer = Buffer.from(cipherText, 'hex');
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buffer);
    } catch (error) {
      console.error(`Can not decrypt secret ${error.toString()}`);
      return cipherText;
    }
  }
  return cipherText;
}

async function encrypt(raw: any) {
  if (!raw) {
    return raw;
  }
  const stringified = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return `${encryptionPrefix}${await isomorphicEncryptString(stringified)}`;
}

async function decrypt(encrypted: any) {
  if (typeof encrypted !== 'string' || !encrypted.startsWith(encryptionPrefix)) {
    return encrypted;
  }
  encrypted = encrypted.replace(encryptionPrefix, '');
  const decrypted = await isomorphicDecryptString(encrypted);
  try {
    return JSON.parse(decrypted);
  } catch (err) {
    return decrypted;
  }
}

const encryptFields = ['accountId', 'symmetricKey', 'publicKey', 'encPrivateKey'] as const;

async function decryptSession<T extends Partial<UserSession>>(session: T): Promise<T> {
  for (const field of encryptFields) {
    if (Object.prototype.hasOwnProperty.call(session, field)) {
      session[field] = await decrypt(session[field]);
    }
  }
  return session;
}

async function encryptSession<T extends Partial<UserSession>>(session: T): Promise<T> {
  for (const field of encryptFields) {
    if (Object.prototype.hasOwnProperty.call(session, field)) {
      session[field] = await encrypt(session[field]);
    }
  }
  return session;
}

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

  userList = await Promise.all(userList.map(decryptSession));

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
  user = await encryptSession(user);
  patch = await encryptSession(patch);
  let updatedUser = await db.docUpdate<UserSession>(user, patch);
  updatedUser = await decryptSession(updatedUser);
  return updatedUser;
}

export async function patch(patch: Partial<UserSession>) {
  let user = await getOrCreate();
  user = await encryptSession(user);
  patch = await encryptSession(patch);
  let updatedUser = await db.docUpdate<UserSession>(user, patch);
  updatedUser = await decryptSession(updatedUser);
  return updatedUser;
}

export async function getOrCreate() {
  let result = await db.findOne<UserSession>(type);

  if (!result) {
    return await create();
  }
  result = await decryptSession(result);
  return result;
}

export async function get() {
  return getOrCreate();
}
