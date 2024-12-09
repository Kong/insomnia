export interface CloudServiceError {
  errorCode: string;
  errorMessage: string;
}
export interface CloudServiceResult<T> {
  success: boolean;
  result: T | null;
  error?: CloudServiceError;
}
export interface ICloudService {
  authenticate(...args: any[]): Promise<any>;
  getSecret<T extends {}>(secretName: string, config?: T): Promise<any>;
  getSecret(secretName: string): Promise<any>;
  getUniqueCacheKey<T extends {} = {}>(secretName: string, config?: T): string;
}

export type AWSSecretType = 'kv' | 'plaintext';
export interface AWSSecretConfig {
  SecretId: string;
  VersionId?: string;
  VersionStage?: string;
  SecretType: AWSSecretType;
  SecretKey?: string;
};

export type AzureSecretType = 'secret' | 'key';
export interface AzureSecretConfig {
  secretIdentifier: string;
  secretType: AzureSecretType;
}
export type ExternalVaultConfig = AWSSecretConfig | AzureSecretConfig;

export abstract class OAuthCloudService {
  static async openAuthUrl() {
    throw new Error('Subclasses must implement the static method openAuthUrl');
  };

  static async exchangeCode(data: any): Promise<any> {
    throw new Error(`Subclasses must implement the static method exchangeCode with ${data}`);
  };
};
