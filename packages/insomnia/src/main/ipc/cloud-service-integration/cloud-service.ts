import * as models from '../../../models';
import type { AWSTemporaryCredential, CloudeProviderCredentialType, CloudProviderName } from '../../../models/cloud-credential';
import { ipcMainHandle, ipcMainOn } from '../electron';
import { type AWSGetSecretConfig, AWSService } from './aws-service';
import { type MaxAgeUnit, VaultCache } from './vault-cache';

// in-memory cache for fetched vault secrets
const vaultCache = new VaultCache();

export interface cloudServiceBridgeAPI {
  authenticate: typeof cspAuthentication;
  getSecret: typeof getSecret;
  clearCache: typeof clearVaultCache;
  setCacheMaxAge: typeof setCacheMaxAge;
}
export interface CloudServiceAuthOption {
  provider: CloudProviderName;
  credentials: CloudeProviderCredentialType;
}
export interface CloudServiceSecretOption<T extends {}> extends CloudServiceAuthOption {
  secretId: string;
  config?: T;
}
export type CloudServiceGetSecretConfig = AWSGetSecretConfig;

export function registerCloudServiceHandlers() {
  ipcMainHandle('cloudService.authenticate', (_event, options) => cspAuthentication(options));
  ipcMainHandle('cloudService.getSecret', (_event, options) => getSecret(options));
  ipcMainOn('cloudService.clearCache', () => clearVaultCache());
  ipcMainOn('cloudService.setCacheMaxAge', (_event, maxAge, unit) => setCacheMaxAge(maxAge, unit));
}

type CredentialType = AWSTemporaryCredential;
// factory pattern to create cloud service class based on its provider name
class ServiceFactory {
  static createCloudService(name: CloudProviderName, credential: CredentialType) {
    switch (name) {
      case 'aws':
        return new AWSService(credential as AWSTemporaryCredential);
      default:
        throw new Error('Invalid cloud service provider name');
    }
  }
};

const clearVaultCache = () => {
  return vaultCache.clear();
};

const setCacheMaxAge = (newAge: number, unit: MaxAgeUnit = 'min') => {
  return vaultCache.setMaxAge(newAge, unit);
};

// authenticate with cloud service provider
const cspAuthentication = (options: CloudServiceAuthOption) => {
  const { provider, credentials } = options;
  const cloudService = ServiceFactory.createCloudService(provider, credentials);
  return cloudService.authorize();
};

const getSecret = async (options: CloudServiceSecretOption<CloudServiceGetSecretConfig>) => {
  const { provider, credentials, secretId, config } = options;
  const cloudService = ServiceFactory.createCloudService(provider, credentials);
  const uniqueSecretKey = cloudService.getUniqueCacheKey(secretId, config);
  if (vaultCache.has(uniqueSecretKey)) {
    // return cache value if exists
    return vaultCache.getItem(uniqueSecretKey);
  }
  const secretResult = await cloudService.getSecret(secretId, config);
  if (secretResult.success) {
    const settings = await models.settings.get();
    const maxAge = Number(settings.vaultSecretCacheDuration) * 1000 * 60;
    // set cached value after success
    vaultCache.setItem(uniqueSecretKey, secretResult, { maxAge });
  }
  return secretResult;
};
