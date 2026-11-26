import {
  getAccessToken,
  getTokenStatus,
  type KonnectOAuthAccessToken,
  type KonnectOAuthLoginResult,
  login,
  logout,
} from '../konnect/oauth';
import { ipcMainHandle } from './electron';

export interface konnectOAuthBridgeAPI {
  login: (organizationId: string) => Promise<KonnectOAuthLoginResult>;
  getAccessToken: (organizationId: string) => Promise<KonnectOAuthAccessToken | null>;
  getTokenStatus: (organizationId: string) => Promise<{ connected: boolean; expiresAt: number | null }>;
  logout: (organizationId: string) => Promise<void>;
}

export function registerKonnectOAuthHandlers() {
  ipcMainHandle('konnectOAuth.login', (_, organizationId: string) => login(organizationId));
  ipcMainHandle('konnectOAuth.getAccessToken', (_, organizationId: string) => getAccessToken(organizationId));
  ipcMainHandle('konnectOAuth.getTokenStatus', (_, organizationId: string) => getTokenStatus(organizationId));
  ipcMainHandle('konnectOAuth.logout', (_, organizationId: string) => logout(organizationId));
}
