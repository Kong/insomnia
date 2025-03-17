import * as models from '../../../models';
import type { AWSTemporaryCredential, BaseCloudCredential, CloudProviderName, HashiCorpCredentials } from '../../../models/cloud-credential';
import { ipcMainHandle, ipcMainOn } from '../electron';
import { type AWSGetSecretConfig, AWSService } from './aws-service';
import { type GCPGetSecretConfig, GCPService } from './gcp-servcie';
import { HashiCorpService } from './hashicorp-service';
import type { HashiCorpSecretConfig } from './types';
import { type MaxAgeUnit, VaultCache } from './vault-cache';

// in-memory cache for fetched vault secrets
const vaultCache = new VaultCache();

export interface cloudServiceBridgeAPI {
  authenticate: typeof cloudServiceProviderAuthentication;
  getSecret: typeof getSecret;
  clearCache: typeof clearVaultCache;
  setCacheMaxAge: typeof setCacheMaxAge;
}
export interface CloudServiceAuthOption {
  provider: CloudProviderName;
  credentials: BaseCloudCredential['credentials'];
}
interface CloudServiceGetSecretConfigMapping {
  'aws': AWSGetSecretConfig;
  'gcp': GCPGetSecretConfig;
  'hashicorp': HashiCorpSecretConfig;
  'azure': never;
};
export interface CloudServiceSecretOption extends CloudServiceAuthOption {
  secretId: string;
  config: CloudServiceGetSecretConfigMapping[this['provider']];
}
export type CloudServiceGetSecretConfig = AWSGetSecretConfig | GCPGetSecretConfig;

export function registerCloudServiceHandlers() {
  ipcMainHandle('cloudService.authenticate', (_event, options) => cloudServiceProviderAuthentication(options));
  ipcMainHandle('cloudService.getSecret', (_event, options) => getSecret(options));
  ipcMainOn('cloudService.clearCache', () => clearVaultCache());
  ipcMainOn('cloudService.setCacheMaxAge', (_event, { maxAge, unit }) => setCacheMaxAge(maxAge, unit));
}

// factory pattern to create cloud service class based on its provider name
class ServiceFactory {
  static createCloudService(name: CloudProviderName, credential: BaseCloudCredential['credentials']) {
    switch (name) {
      case 'aws':
        return new AWSService(credential as AWSTemporaryCredential);
      case 'gcp':
        return new GCPService(credential as string);
      case 'hashicorp':
        return new HashiCorpService(credential as HashiCorpCredentials);
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
export const cloudServiceProviderAuthentication = (options: CloudServiceAuthOption) => {
  const { provider, credentials } = options;
  const cloudService = ServiceFactory.createCloudService(provider, credentials);
  return cloudService.authenticate();
};

export const getSecret = async (options: CloudServiceSecretOption) => {
  const { provider, credentials, secretId, config } = options;
  const cloudService = ServiceFactory.createCloudService(provider, credentials);
  const uniqueSecretKey = cloudService.getUniqueCacheKey(secretId, config as any);
  if (vaultCache.has(uniqueSecretKey)) {
    // return cache value if exists
    return vaultCache.getItem(uniqueSecretKey);
  }
  const secretResult = await cloudService.getSecret(secretId, config as any);
  if (secretResult.success) {
    const settings = await models.settings.get();
    const maxAge = Number(settings.vaultSecretCacheDuration) * 1000 * 60;
    // set cached value after success
    vaultCache.setItem(uniqueSecretKey, secretResult, { maxAge });
  }
  return secretResult;
};
