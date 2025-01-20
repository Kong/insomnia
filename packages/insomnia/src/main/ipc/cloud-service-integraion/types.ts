export interface CloudServiceError {
  errorCode: string;
  errorMessage: string;
}
export interface CloudServiceResult<T extends Record<string, any>> {
  success: boolean;
  result?: T | null;
  error?: CloudServiceError;
}
export interface ICloudService {
  authenticate(...args: any[]): Promise<any>;
  getSecret(secretName: string, config: any): Promise<any>;
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

export type ExternalVaultConfig = AWSSecretConfig;
