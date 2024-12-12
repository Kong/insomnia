import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import crypto from 'crypto';
import { GoogleAuth, type JWTInput } from 'google-auth-library';

import type { CloudProviderName } from '../../../models/cloud-credential';
import type { CloudServiceResult, GCPSecretConfig, ICloudService } from './types';

export const providerName: CloudProviderName = 'gcp';
export type GCPGetSecretConfig = Omit<GCPSecretConfig, 'secretName'>;
export class GCPService implements ICloudService {
  _credential: JWTInput;

  constructor(credential: JWTInput) {
    this._credential = credential;
  }

  async authenticate(): Promise<CloudServiceResult<{}>> {
    const credentials = this._credential;
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'], // General scope for GCP
    });
    try {
      const client = await auth.getClient();
      // use get access token to validate credential
      await client.getAccessToken();
      return {
        success: true,
        result: {},
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: { errorMessage: error?.message, errorCode: error?.code },
      };
    }
  }

  getUniqueCacheKey(secretName: string, config?: GCPGetSecretConfig) {
    const { project_id } = this._credential;
    const { version = 'latest' } = config || {};
    const uniqueKey = `${providerName}:${secretName}:${project_id}:${version}`;
    const uniqueKeyHash = crypto.createHash('md5').update(uniqueKey).digest('hex');
    return uniqueKeyHash;
  }

  async getSecret(secretName: string, config: GCPGetSecretConfig): Promise<CloudServiceResult<{ value: string }>> {
    const { version = 'latest' } = config;
    const { project_id } = this._credential;
    const secretClient = new SecretManagerServiceClient({
      credentials: this._credential,
    });
    const fullPathSecretNamePattern = /^projects\/[a-z0-9-]+\/secrets\/[a-zA-Z0-9_-]+$/;
    let finalSecretName: string;
    if (fullPathSecretNamePattern.test(secretName)) {
      // if secret name in pattern /projects/<project_id>/secrets/<secret_name> which is copied from gcp
      finalSecretName = `${secretName}/versions/${version}`;
    } else {
      finalSecretName = `projects/${project_id}/secrets/${secretName}/versions/${version}`;
    }
    try {
      const [versionResponse] = await secretClient.accessSecretVersion({ name: finalSecretName });
      const secretResult = versionResponse.payload?.data?.toString() || '';
      return {
        success: true,
        result: { value: secretResult },
      };
    } catch (error) {
      console.error(error);
      return {
        success: false,
        result: null,
        error: { errorMessage: error.toString(), errorCode: error?.code },
      };
    }
  }
};
