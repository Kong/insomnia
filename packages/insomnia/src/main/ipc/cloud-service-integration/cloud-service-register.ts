import { ipcMainHandle, ipcMainOn } from '../electron';
import {
  clearVaultCache,
  cloudServiceProviderAuthentication,
  exchangeCode,
  getSecret,
  openAuthUrl,
  setCacheMaxAge,
} from './cloud-service';

export interface cloudServiceBridgeAPI {
  authenticate: typeof cloudServiceProviderAuthentication;
  getSecret: typeof getSecret;
  clearCache: typeof clearVaultCache;
  setCacheMaxAge: typeof setCacheMaxAge;
  openAuthUrl: typeof openAuthUrl;
  exchangeCode: typeof exchangeCode;
}

export function registerCloudServiceHandlers() {
  ipcMainHandle('cloudService.authenticate', (_event, options) => cloudServiceProviderAuthentication(options));
  ipcMainHandle('cloudService.getSecret', (_event, options) => getSecret(options));
  ipcMainHandle('cloudService.exchangeCode', (_event, type, data) => exchangeCode(type, data));
  ipcMainOn('cloudService.openAuthUrl', (_event, type) => openAuthUrl(type));
  ipcMainOn('cloudService.clearCache', () => clearVaultCache());
  ipcMainOn('cloudService.setCacheMaxAge', (_event, { maxAge, unit }) => setCacheMaxAge(maxAge, unit));
}
