// @flow
import type { BaseModel } from './index';

import * as db from '../common/database';

type BaseOAuth2Token = {
  refreshToken: string,
  accessToken: string,
  expiresAt: number | null, // Should be Date.now() if valid

  // Debug
  xResponseId: string | null,
  xError: string | null,

  // Error handling
  error: string,
  errorDescription: string,
  errorUri: string
};

export type OAuth2Token = BaseModel & BaseOAuth2Token;

export const name = 'OAuth 2.0 Token';
export const type = 'OAuth2Token';
export const prefix = 'oa2';
export const canDuplicate = false;

export function init(): BaseOAuth2Token {
  return {
    refreshToken: '',
    accessToken: '',
    expiresAt: null, // Should be Date.now() if valid

    // Debug
    xResponseId: null,
    xError: null,

    // Error handling
    error: '',
    errorDescription: '',
    errorUri: ''
  };
}

export function migrate<T>(doc: T): T {
  return doc;
}

export function create(patch: Object = {}): Promise<OAuth2Token> {
  if (!patch.parentId) {
    throw new Error(
      `New OAuth2Token missing \`parentId\` ${JSON.stringify(patch)}`
    );
  }

  return db.docCreate(type, patch);
}

export function update(
  token: OAuth2Token,
  patch: Object
): Promise<OAuth2Token> {
  return db.docUpdate(token, patch);
}

export function remove(token: OAuth2Token): Promise<void> {
  return db.remove(token);
}

export function getByParentId(parentId: string): Promise<OAuth2Token | null> {
  return db.getWhere(type, { parentId });
}

export async function getOrCreateByParentId(
  parentId: string
): Promise<OAuth2Token> {
  let token = await db.getWhere(type, { parentId });

  if (!token) {
    token = await create({ parentId });
  }

  return token;
}

export function all(): Promise<Array<OAuth2Token>> {
  return db.all(type);
}
