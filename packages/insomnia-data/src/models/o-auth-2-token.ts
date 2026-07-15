import type { BaseModel } from './base-types';

export const name = 'OAuth 2.0 Token';

export const type = 'OAuth2Token';

export const prefix = 'oa2';

export const canDuplicate = false;

export const canSync = false;

export interface BaseOAuth2Token {
  refreshToken: string;
  accessToken: string;
  identityToken: string;
  expiresAt: number | null;
  // Should be Date.now() if valid
  // Debug
  xResponseId: string | null;
  xError: string | null;
  // Error handling
  error: string;
  errorDescription: string;
  errorUri: string;
}

export type OAuth2Token = BaseModel & BaseOAuth2Token;

export const isOAuth2Token = (model: Pick<BaseModel, 'type'>): model is OAuth2Token => model.type === type;

export function init(): BaseOAuth2Token {
  return {
    refreshToken: '',
    accessToken: '',
    identityToken: '',
    expiresAt: null,
    // Should be Date.now() if valid
    // Debug
    xResponseId: null,
    xError: null,
    // Error handling
    error: '',
    errorDescription: '',
    errorUri: '',
  };
}
