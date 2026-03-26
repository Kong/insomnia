import type { AESMessage } from '~/account/crypt';
import type { BaseModel } from '~/models/types';
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
