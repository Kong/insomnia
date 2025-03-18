import type { CloudServiceSecretOption } from '../../../main/ipc/cloud-service-integration/cloud-service';
import type { HashiCorpVaultKVV1SecretValue, HashiCorpVaultKVV2SecretValue, HCPStaticSecretValue } from '../../../main/ipc/cloud-service-integration/hashicorp-service';
import type { AWSSecretConfig, ExternalVaultConfig, GCPSecretConfig, HashiCorpSecretConfig, HashiCorpVaultKVV1SecretConfig, HashiCorpVaultKVV2SecretConfig, HCPSecretConfig } from '../../../main/ipc/cloud-service-integration/types';
import type { CloudProviderCredential, CloudProviderName, HashiCorpCredentials } from '../../../models/cloud-credential';
import type { PluginTemplateTagContext } from '../../../templating/types';
import { invariant } from '../../../utils/invariant';

export const getExternalVault = async (_context: PluginTemplateTagContext, provider: CloudProviderName, providerCredential: CloudProviderCredential, secretConfig: ExternalVaultConfig) => {
  switch (provider) {
    case 'aws':
      return getAWSSecret(_context, secretConfig as AWSSecretConfig, providerCredential);
    case 'gcp':
      return getGCPSecret(_context, secretConfig as GCPSecretConfig, providerCredential);
    case 'hashicorp':
      return getHashiCorpSecret(_context, secretConfig as HashiCorpSecretConfig, providerCredential);
    default:
      return '';
  }
};

const handleCloudServiceRequest = async (context: PluginTemplateTagContext, name: 'authenticate' | 'getSecret', options: any) => {
  if (process.type === 'worker') {
    return await context.util.externalVault[name](options);
  } else if (process.type === 'renderer') {
    return await window.main.cloudService[name](options);
  }
  // Todo support running in inso
};

export const getAWSSecret = async (context: PluginTemplateTagContext, secretConfig: AWSSecretConfig, providerCredential: CloudProviderCredential) => {
  const {
    SecretId, VersionId, VersionStage, SecretKey,
    SecretType = 'plaintext',
  } = secretConfig;
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
  const secretResult = await handleCloudServiceRequest(context, 'getSecret', getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    const { SecretString } = result!;
    let parsedJSON;
    if (SecretType === 'plaintext' || !SecretKey) {
      return SecretString;
    } else {
      try {
        parsedJSON = JSON.parse(SecretString || '{}');
      } catch (error) {
        throw new Error(`Get secret from AWS failed: Secret value ${SecretString} can not parsed to key/value pair, please change Secret Type to plaintext`);
      }
      if (SecretKey in parsedJSON) {
        return parsedJSON[SecretKey];
      }
      throw new Error(`Get secret from AWS failed: Secret key ${SecretKey} does not exist in key/value secret ${SecretString}`);
    }
  } else {
    throw new Error(`Get secret from AWS failed: ${error?.errorMessage}`);
  }
};

export const getGCPSecret = async (context: PluginTemplateTagContext, secretConfig: GCPSecretConfig, providerCredential: CloudProviderCredential) => {
  const { secretName, version } = secretConfig;
  if (!secretName) {
    throw new Error('Get secret from GCP failed: Secret Name is required');
  }
  const getSecretOption: CloudServiceSecretOption = {
    provider: 'gcp',
    secretId: secretName,
    credentials: providerCredential.credentials,
    config: { version },
  };
  const secretResult = await handleCloudServiceRequest(context, 'getSecret', getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    return result.value;
  } else {
    throw new Error(`Get secret from GCP failed: ${error?.errorMessage}`);
  }
};

export const getHashiCorpSecret = async (context: PluginTemplateTagContext, secretConfig: HashiCorpSecretConfig, providerCredential: CloudProviderCredential) => {
  const { secretName } = secretConfig;
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
    secretId: secretConfig.secretName,
    credentials,
    config: secretConfig,
  };
  // Check if the token is expired. 0 means the token never expires like root token
  const { expires_at } = credentials as HashiCorpCredentials;
  if (typeof expires_at === 'number' && expires_at !== 0 && expires_at < Date.now()) {
    const authResponse = await handleCloudServiceRequest(context, 'authenticate', { provider: providerName, credentials });
    const { success, result, error } = authResponse!;
    if (success && result) {
      const { access_token, expires_at } = result as { access_token: string; expires_at: number };
      // update access_token and expires_at
      const originCredential = await context.util.models.cloudCredential.getById(cloudCredentialId);
      invariant(originCredential, 'No Cloud Credential found');
      const originHashiCorpCredential = originCredential.credentials as HashiCorpCredentials;
      const patch = {
        credentials: {
          ...originHashiCorpCredential,
          access_token, expires_at,
        },
      } as { credentials: HashiCorpCredentials };
      await context.util.models.cloudCredential.update(originCredential, patch);
      getSecretOption.credentials = patch.credentials;
    } else {
      // failed to get new token
      throw new Error(error?.errorMessage);
    };
  };
  const secretResult = await handleCloudServiceRequest(context, 'getSecret', getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    if (type === 'cloud') {
      // cloud static secret value
      const { value } = result as HCPStaticSecretValue;
      return value;
    } else {
      const { kvVersion, secretKey } = secretConfig as HashiCorpVaultKVV1SecretConfig | HashiCorpVaultKVV2SecretConfig;
      if (kvVersion === 'v1') {
        // onPrem kv v1 secert value
        const { data } = result as HashiCorpVaultKVV1SecretValue;
        if (secretKey) {
          if (secretKey in data) {
            return data[secretKey];
          } else {
            throw new Error(`Secret key ${secretKey} does not exist in kv secert data ${JSON.stringify(data)}`);
          }
        } else {
          return JSON.stringify(data);
        }
      } else if (kvVersion === 'v2') {
        // onPrem kv v2 secert value
        const { data } = result as HashiCorpVaultKVV2SecretValue;
        const { data: secretV2Data } = data;
        if (secretKey) {
          if (secretKey in secretV2Data) {
            return secretV2Data[secretKey];
          } else {
            throw new Error(`Secret key ${secretKey} does not exist in kv secert data ${JSON.stringify(secretV2Data)}`);
          }
        } else {
          return JSON.stringify(secretV2Data);
        }
      };
    };
    return result.toString();
  } else {
    throw new Error(error?.errorMessage);
  }
};
