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
  authorize(): Promise<any>;
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
