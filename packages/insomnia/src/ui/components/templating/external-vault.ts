import type { CloudServiceSecretOption } from '../../../main/ipc/cloud-service-integration/cloud-service';
import type { cloudServiceProviderAuthentication, getSecret } from '../../../main/ipc/cloud-service-integration/cloud-service';
import type { HashiCorpVaultKVV1SecretValue, HashiCorpVaultKVV2SecretValue, HCPStaticSecretValue } from '../../../main/ipc/cloud-service-integration/hashicorp-service';
import type { AWSSecretConfig, AzureSecretConfig, ExternalVaultConfig, GCPSecretConfig, HashiCorpSecretConfig, HashiCorpVaultKVV1SecretConfig, HashiCorpVaultKVV2SecretConfig, HCPSecretConfig } from '../../../main/ipc/cloud-service-integration/types';
import type { CloudProviderCredential, CloudProviderName, HashiCorpCredentials } from '../../../models/cloud-credential';
import { invariant } from '../../../utils/invariant';
export interface getExternalVaultOptions {
  provider: CloudProviderName;
  providerCredential: CloudProviderCredential;
  secretConfig: ExternalVaultConfig;
  cloudServiceContext: {
    getSecret?: typeof getSecret;
    authenticate?: typeof cloudServiceProviderAuthentication;
    models: {
      getById: (id: string) => Promise<CloudProviderCredential | null>;
      update: (credential: CloudProviderCredential, patch: Partial<CloudProviderCredential>) => Promise<CloudProviderCredential>;
    }
  },
}
export const getExternalVault = async (options: getExternalVaultOptions) => {
  switch (options.provider) {
    case 'aws':
      return getAWSSecret(options);
    case 'gcp':
      return getGCPSecret(options);
    case 'hashicorp':
      return getHashiCorpSecret(options);
    case 'azure':
      return getAzureSecret(options);
    default:
      return '';
  }
};

const handleCloudServiceRequest = async (cloudServiceContext: getExternalVaultOptions["cloudServiceContext"], name: 'authenticate' | 'getSecret', options: any) => {
  if (process.type === 'worker') {
    return await cloudServiceContext[name]!(options);
  } else if (process.type === 'renderer') {
    return await window.main.cloudService[name](options);
  }
  // running in inso or main
  return (await import('insomnia/src/main/ipc/cloud-service-integration/cloud-service'))[name === 'authenticate' ? 'cloudServiceProviderAuthentication' : 'getSecret'](options);

};

export const getAWSSecret = async (options: getExternalVaultOptions) => {
  const { secretConfig, providerCredential, cloudServiceContext } = options;
  const {
    SecretId, VersionId, VersionStage, SecretKey,
    SecretType = 'plaintext',
  } = secretConfig as AWSSecretConfig;
  if (!SecretId) {
    throw new Error('Get secret from AWS failed: Secret Name or ARN is required');
  }
  const getSecretOption: CloudServiceSecretOption = {
    provider: 'aws',
    secretId: SecretId,
    config: {
      VersionId, VersionStage,
    },
    credentials: providerCredential.credentials,
  };
  const secretResult = await handleCloudServiceRequest(cloudServiceContext, 'getSecret', getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    const { SecretString } = result!;
    let parsedJSON;
    if (SecretType === 'plaintext' || !SecretKey) {
      return SecretString;
    }
    try {
      parsedJSON = JSON.parse(SecretString || '{}');
    } catch (error) {
      throw (`Get secret from AWS failed: Secret value ${SecretString} can not parsed to key/value pair, please change Secret Type to plaintext`);
    }
    if (SecretKey in parsedJSON) {
      return parsedJSON[SecretKey];
    }
    throw (`Get secret from AWS failed: Secret key ${SecretKey} does not exist in key/value secret ${SecretString}`);

  } else {
    throw new Error(`Get secret from AWS failed: ${error?.errorMessage}`);
  }
};

export const getGCPSecret = async (options: getExternalVaultOptions) => {
  const { secretConfig, providerCredential, cloudServiceContext } = options;
  const { secretName, version } = secretConfig as GCPSecretConfig;
  if (!secretName) {
    throw new Error('Get secret from GCP failed: Secret Name is required');
  }
  const getSecretOption: CloudServiceSecretOption = {
    provider: 'gcp',
    secretId: secretName,
    credentials: providerCredential.credentials,
    config: { version },
  };
  const secretResult = await handleCloudServiceRequest(cloudServiceContext, 'getSecret', getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    return result.value;
  }
  throw new Error(`Get secret from GCP failed: ${error?.errorMessage}`);

};

export const getAzureSecret = async (options: getExternalVaultOptions) => {
  const { secretConfig, providerCredential, cloudServiceContext } = options;
  const { secretIdentifier } = secretConfig as AzureSecretConfig;
  if (!secretIdentifier) {
    throw new Error('Get secret from Azure failed: Secret Identifier is required');
  }
  const getSecretOption: CloudServiceSecretOption = {
    provider: 'azure',
    secretId: secretIdentifier,
    credentials: providerCredential.credentials,
    config: {},
  };
  const secretResult = await handleCloudServiceRequest(cloudServiceContext, 'getSecret', getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    return result.value;
  };
  throw new Error(`Get secret from Azure failed: ${error?.errorMessage}`);
};

export const getHashiCorpSecret = async (options: getExternalVaultOptions) => {
  const { secretConfig, providerCredential, cloudServiceContext } = options;
  const { secretName } = secretConfig as HashiCorpSecretConfig;
  const providerName = 'hashicorp';
  if (!secretName) {
    throw new Error('Secret Name is required');
  }
  const { credentials, _id: cloudCredentialId } = providerCredential;
  const { type } = credentials as HashiCorpCredentials;
  if (type === 'cloud') {
    const { organizationId, projectId, appName } = secretConfig as HCPSecretConfig;
    if (!organizationId || !projectId || !appName) {
      throw new Error('Organization Id, Project Id, App Name is required');
    }
  } else {
    const { secretEnginePath } = secretConfig as HashiCorpVaultKVV1SecretConfig;
    if (!secretEnginePath) {
      throw new Error('Secret Engine Path is required');
    }
  };
  const getSecretOption: CloudServiceSecretOption = {
    provider: providerName,
    secretId: (secretConfig as HashiCorpSecretConfig).secretName,
    credentials,
    config: secretConfig as HashiCorpSecretConfig,
  };
  // Check if the token is expired. 0 means the token never expires like root token
  const { expires_at } = credentials as HashiCorpCredentials;
  if (typeof expires_at === 'number' && expires_at !== 0 && expires_at < Date.now()) {
    const authResponse = await handleCloudServiceRequest(cloudServiceContext, 'authenticate', { provider: providerName, credentials });
    const { success, result, error } = authResponse!;
    if (success && result) {
      const { access_token, expires_at } = result as { access_token: string; expires_at: number };
      // update access_token and expires_at
      const originCredential = await cloudServiceContext.models.getById(cloudCredentialId);
      invariant(originCredential, 'No Cloud Credential found');
      const originHashiCorpCredential = originCredential.credentials as HashiCorpCredentials;
      const patch = {
        credentials: {
          ...originHashiCorpCredential,
          access_token, expires_at,
        },
      } as { credentials: HashiCorpCredentials };
      await cloudServiceContext.models.update(originCredential, patch);
      getSecretOption.credentials = patch.credentials;
    } else {
      // failed to get new token
      throw new Error(error?.errorMessage);
    };
  };
  const secretResult = await handleCloudServiceRequest(cloudServiceContext, 'getSecret', getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    if (type === 'cloud') {
      // cloud static secret value
      const { value } = result as HCPStaticSecretValue;
      return value;
    }
    const { kvVersion, secretKey } = secretConfig as HashiCorpVaultKVV1SecretConfig | HashiCorpVaultKVV2SecretConfig;
    if (kvVersion === 'v1') {
      // onPrem kv v1 secret value
      const { data } = result as HashiCorpVaultKVV1SecretValue;
      if (secretKey) {
        invariant(secretKey in data, `Secret key ${secretKey} does not exist in kv secret data ${JSON.stringify(data)}`)
        return data[secretKey];
      }
      return JSON.stringify(data);
    } else if (kvVersion === 'v2') {
      // onPrem kv v2 secret value
      const { data } = result as HashiCorpVaultKVV2SecretValue;
      const { data: secretV2Data } = data;
      if (secretKey) {
        invariant(secretKey in secretV2Data, `Secret key ${secretKey} does not exist in kv secret data ${JSON.stringify(secretV2Data)}`)
        return secretV2Data[secretKey];
      }
      return JSON.stringify(secretV2Data);
    };
    return result.toString();
  }
  throw new Error(error?.errorMessage);
};
