import type { AWSGetSecretConfig } from '../../../main/ipc/cloud-service-integraion/aws-service';
import type { CloudServiceSecretOption } from '../../../main/ipc/cloud-service-integraion/cloud-service';
import type { AWSSecretConfig, AzureSecretConfig, ExternalVaultConfig } from '../../../main/ipc/cloud-service-integraion/types';
import type { CloudProviderCredential, CloudProviderName } from '../../../models/cloud-credential';

export const getExternalVault = async (provider: CloudProviderName, providerCredential: CloudProviderCredential, secretConfig: ExternalVaultConfig) => {
  switch (provider) {
    case 'aws':
      return getAWSSecret(secretConfig as AWSSecretConfig, providerCredential);
    case 'azure':
      return getAzureSecret(secretConfig as AzureSecretConfig, providerCredential);
    default:
      return '';
  }
};

export const getAWSSecret = async (secretConfig: AWSSecretConfig, providerCredential: CloudProviderCredential) => {
  const {
    SecretId, VersionId, VersionStage, SecretKey,
    SecretType = 'plaintext',
  } = secretConfig;
  if (!SecretId) {
    throw new Error('Secret Name or ARN is required');
  }
  const getSecretOption: CloudServiceSecretOption<AWSGetSecretConfig> = {
    provider: 'aws',
    secretId: SecretId,
    config: {
      VersionId, VersionStage,
    },
    credentials: providerCredential.credentials,
  };
  const secretResult = await window.main.cloudService.getSecret(getSecretOption);
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
        throw new Error(`Secret value ${SecretString} can not parsed to key/value pair, please change Secret Type to plaintext`);
      }
      if (SecretKey in parsedJSON) {
        return parsedJSON[SecretKey];
      }
      throw new Error(`Secret key ${SecretKey} does not exist in key/value secret ${SecretString}`);
    }
  } else {
    throw new Error(error?.errorMessage);
  }
};

export const getAzureSecret = async (secretConfig: AzureSecretConfig, providerCredential: CloudProviderCredential) => {
  const { secretIdentifier } = secretConfig;
  if (!secretIdentifier) {
    throw new Error('Secret Identifieror is required');
  }
  const getSecretOption: CloudServiceSecretOption<{}> = {
    provider: 'azure',
    secretId: secretIdentifier,
    credentials: providerCredential.credentials,
  };
  const secretResult = await window.main.cloudService.getSecret(getSecretOption);
  const { success, error, result } = secretResult;
  if (success && result) {
    return result.value;
  } else {
    throw new Error(error?.errorMessage);
  }
};
