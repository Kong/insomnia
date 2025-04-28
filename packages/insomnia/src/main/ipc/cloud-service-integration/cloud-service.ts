import type { AuthenticationResult as AzureOAuthCredential } from '@azure/msal-node';

import * as models from '../../../models';
import type {
  AWSTemporaryCredential,
  BaseCloudCredential,
  CloudProviderName,
  GCPCredentials,
  HashiCorpCredentials,
} from '../../../models/cloud-credential';
import { AzureService } from '../cloud-service-integration/azure-service';
import { type AWSGetSecretConfig, AWSService } from './aws-service';
import { type GCPGetSecretConfig, GCPService } from './gcp-service';
import { HashiCorpService } from './hashicorp-service';
import type { HashiCorpSecretConfig } from './types';
import { type MaxAgeUnit, VaultCache } from './vault-cache';

// in-memory cache for fetched vault secrets
const vaultCache = new VaultCache();

export interface CloudServiceAuthOption {
  provider: CloudProviderName;
  credentials: BaseCloudCredential['credentials'];
}
interface CloudServiceGetSecretConfigMapping {
  aws: AWSGetSecretConfig;
  gcp: GCPGetSecretConfig;
  hashicorp: HashiCorpSecretConfig;
  azure: never;
}
export interface CloudServiceSecretOption extends CloudServiceAuthOption {
  secretId: string;
  config: CloudServiceGetSecretConfigMapping[this['provider']];
}
export type CloudServiceGetSecretConfig = AWSGetSecretConfig | GCPGetSecretConfig;

// factory pattern to create cloud service class based on its provider name
function createCloudService(name: CloudProviderName, credential: BaseCloudCredential['credentials']) {
  switch (name) {
    case 'aws':
      return new AWSService(credential as AWSTemporaryCredential);
    case 'gcp':
      return new GCPService(
        // for backward compatibility, gcp credential used to be a string of service account key file path
        typeof credential === 'string' ? credential : (credential as GCPCredentials).serviceAccountKeyFilePath,
      );
    case 'hashicorp':
      return new HashiCorpService(credential as HashiCorpCredentials);
    case 'azure':
      return new AzureService(credential as AzureOAuthCredential);
    default:
      throw new Error('Invalid cloud service provider name');
  }
}

// authenticate with cloud service provider
export const cloudServiceProviderAuthentication = (options: CloudServiceAuthOption) => {
  const { provider, credentials } = options;
  const cloudService = createCloudService(provider, credentials);
  return cloudService.authenticate();
};

export const openAuthUrl = (type: 'azure') => {
  switch (type) {
    case 'azure':
      AzureService.openAuthUrl();
      break;
    default:
      return;
  }
};

export const exchangeCode = async (type: 'azure', data: any) => {
  // eslint-disable-next-line default-case
  switch (type) {
    case 'azure':
      return AzureService.exchangeCode(data);
  }
};

export const getSecret = async (options: CloudServiceSecretOption) => {
  const { provider, credentials, secretId, config } = options;
  const cloudService = createCloudService(provider, credentials);
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

export const clearVaultCache = () => {
  return vaultCache.clear();
};

export const setCacheMaxAge = (newAge: number, unit: MaxAgeUnit = 'min') => {
  return vaultCache.setMaxAge(newAge, unit);
};
