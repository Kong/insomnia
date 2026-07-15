import type { BaseModel } from './base-types';

export type CloudProviderName = 'aws' | 'azure' | 'gcp' | 'hashicorp';

// AWS Credentials
export enum AWSCredentialType {
  temp = 'temporary',
  file = 'file',
  sso = 'sso',
}
export interface AWSTemporaryCredential {
  type: AWSCredentialType.temp;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  region: string;
}
export interface AWSFileCredential {
  type: AWSCredentialType.file;
  section: string;
  filePath?: string;
  enableCache?: boolean;
  region: string;
}
export interface AWSSSOCredential {
  type: AWSCredentialType.sso;
  section: string;
  filePath?: string;
  configFilePath?: string;
  enableCache?: boolean;
  region: string;
}
// GCP Credentials
export interface GCPCredential {
  serviceAccountKeyFilePath: string;
}

// HashiCorp Credentials
interface HashiCorpBaseCredential {
  access_token?: string;
  expires_at?: number;
}
export enum HashiCorpCredentialType {
  // Points to the EOS HCP Vault Secrets. Refer: https://developer.hashicorp.com/hcp/docs/vault-secrets/
  cloudVaultSecrets = 'cloud',
  // Points to the HCP Vault Dedicated. Refer: https://developer.hashicorp.com/hcp/docs/vault/
  cloudVaultDedicated = 'cloudVaultDedicated',
  onPrem = 'onPrem',
}
export enum HashiCorpVaultAuthMethod {
  token = 'token',
  appRole = 'appRole',
}
export interface HCPCredential extends HashiCorpBaseCredential {
  client_id: string;
  client_secret: string;
  type: HashiCorpCredentialType.cloudVaultSecrets;
}
export interface HCPVaultDedicatedAppRoleCredential extends HashiCorpBaseCredential {
  role_id: string;
  secret_id: string;
  authMethod: HashiCorpVaultAuthMethod.appRole;
  type: HashiCorpCredentialType.cloudVaultDedicated;
  serverAddress: string;
  namespace: string;
}
export interface HCPVaultDedicatedTokenCredential extends HashiCorpBaseCredential {
  authMethod: HashiCorpVaultAuthMethod.token;
  access_token: string;
  type: HashiCorpCredentialType.cloudVaultDedicated;
  serverAddress: string;
  namespace: string;
}
export interface VaultAppRoleCredential extends HashiCorpBaseCredential {
  role_id: string;
  secret_id: string;
  authMethod: HashiCorpVaultAuthMethod.appRole;
  type: HashiCorpCredentialType.onPrem;
  serverAddress: string;
}
export interface VaultTokenCredential extends HashiCorpBaseCredential {
  authMethod: HashiCorpVaultAuthMethod.token;
  access_token: string;
  type: HashiCorpCredentialType.onPrem;
  serverAddress: string;
}
// Azure Credentials
export interface AzureOAuthCredential {
  expiresOn: Date | null;
  uniqueId: string;
  account: {
    username: string;
  };
  accessToken: string;
}
type BaseCloudCredential =
  | {
      provider: 'aws';
      credentials?: AWSTemporaryCredential | AWSFileCredential | AWSSSOCredential;
    }
  | {
      provider: 'gcp';
      credentials?: GCPCredential;
    }
  | { provider: 'azure'; credentials?: AzureOAuthCredential }
  | {
      provider: 'hashicorp';
      credentials?:
        | HCPCredential
        | VaultAppRoleCredential
        | VaultTokenCredential
        | HCPVaultDedicatedAppRoleCredential
        | HCPVaultDedicatedTokenCredential;
    };
export type CloudProviderCredential = BaseModel & BaseCloudCredential;

export const name = 'Cloud Credential';
export const type = 'CloudCredential';
export const prefix = 'cloudCred';
export const canDuplicate = false;
export const canSync = false;

export const isCloudCredential = (model: Pick<BaseModel, 'type'>): model is CloudProviderCredential =>
  model.type === type;

export function init(): Partial<CloudProviderCredential> {
  return {
    name: '',
    provider: undefined,
    credentials: undefined,
  };
}

export function getProviderDisplayName(provider: CloudProviderName) {
  return (
    {
      aws: 'AWS',
      azure: 'Azure',
      gcp: 'GCP',
      hashicorp: 'HashiCorp',
    }[provider] || ''
  );
}
