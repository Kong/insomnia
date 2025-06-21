import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';

import { GoogleAuth, type JWTInput } from 'google-auth-library';

import type { CloudProviderName } from '../../../models/cloud-credential';
import { isValidJSONString } from '../../../utils/json';
import { createAgent } from './cloud-service-request';
import { nodeCurlRequest } from './cloud-service-request';
import type { CloudServiceResult, GCPSecretConfig, ICloudService } from './types';

export const providerName: CloudProviderName = 'gcp';
export type GCPGetSecretConfig = Omit<GCPSecretConfig, 'secretName'>;

export class GCPService implements ICloudService {
  private _keyPath: string;

  constructor(keyPath: string) {
    this._keyPath = keyPath;
  }

  _validateKeyPath(): { isValid: true; credentials: JWTInput } | { isValid: false; errorMessage: string } {
    const requiredFields = ['project_id', 'private_key_id', 'private_key', 'client_email'];
    const keyPath = this._keyPath;
    let isValid = true;
    let errorMessage = '';

    try {
      const fileContent = readFileSync(keyPath, 'utf-8');
      if (isValidJSONString(fileContent)) {
        const serviceAccountKey = JSON.parse(fileContent.toString()) as JWTInput;
        isValid = requiredFields.every(field => {
          isValid = field in serviceAccountKey;
          if (!isValid) {
            errorMessage = `Required field: ${field} is missing`;
          }
          return isValid;
        });
        if (isValid) {
          return {
            isValid,
            credentials: serviceAccountKey,
          };
        }
      } else {
        isValid = false;
        errorMessage = `Invalid JSON in file ${keyPath}`;
      }
    } catch (error) {
      isValid = false;
      errorMessage = error.message || error.toString();
    }
    return { isValid, errorMessage };
  }

  async _getGoogleAuth(credentials: JWTInput) {
    const agent = await createAgent({});
    const auth = new GoogleAuth({
      credentials,
      // General scope for GCP
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      clientOptions: {
        transporterOptions: {
          agent: agent.httpsAgent,
        },
      },
    });
    return auth;
  }

  async authenticate(): Promise<CloudServiceResult<{ accessToken: string }>> {
    const validateResult = this._validateKeyPath();
    if (validateResult.isValid) {
      const auth = await this._getGoogleAuth(validateResult.credentials);
      try {
        const client = await auth.getClient();
        // use get access token to validate credential
        const accessToken = await client.getAccessToken();
        return {
          success: true,
          result: { accessToken: accessToken.token || '' },
        };
      } catch (error) {
        return {
          success: false,
          error: { errorMessage: error?.message, errorCode: error?.code },
        };
      }
    } else {
      return {
        success: false,
        error: { errorMessage: validateResult.errorMessage, errorCode: '' },
      };
    }
  }

  getUniqueCacheKey(secretName: string, config?: GCPGetSecretConfig) {
    const keyPath = this._keyPath;
    const { version = 'latest' } = config || {};
    const uniqueKey = `${providerName}:${keyPath}:${secretName}:${version}`;
    const uniqueKeyHash = crypto.createHash('md5').update(uniqueKey).digest('hex');
    return uniqueKeyHash;
  }

  async getSecret(secretName: string, config: GCPGetSecretConfig): Promise<CloudServiceResult<{ value: string }>> {
    const { version } = config;
    const secretVersion = version || 'latest';
    const validateResult = this._validateKeyPath();
    if (validateResult.isValid) {
      const authResult = await this.authenticate();
      if (!authResult.success) {
        // authentication failed
        return {
          success: false,
          error: authResult.error,
        };
      }
      // Get google secret manager secret value directly using url
      // Refer: https://cloud.google.com/secret-manager/docs/reference/rest#rest-resource:-v1beta1.projects.secrets.versions
      const secretManagerUrl = 'https://secretmanager.googleapis.com';
      const { credentials } = validateResult;
      const { project_id } = credentials;
      const fullPathSecretNamePattern = /^projects\/[a-z0-9-]+\/secrets\/[a-zA-Z0-9_-]+$/;
      const fullPathSecretNameWithVersionPattern =
        /^projects\/[a-z0-9-]+\/secrets\/[a-zA-Z0-9_-]+\/versions\/[a-zA-Z0-9_-]+$/;
      let finalSecretName: string;
      if (fullPathSecretNamePattern.test(secretName)) {
        // if secret name in pattern /projects/<project_id>/secrets/<secret_name> which is copied from gcp
        finalSecretName = `${secretName}/versions/${secretVersion}`;
      } else if (fullPathSecretNameWithVersionPattern.test(secretName)) {
        // if secret name with version in pattern /projects/<project_id>/secrets/<secret_name>/versions/<version> which is copied from gcp
        finalSecretName = secretName;
      } else {
        finalSecretName = `projects/${project_id}/secrets/${secretName}/versions/${secretVersion}`;
      }
      try {
        const finalUrl = `${secretManagerUrl}/v1/${finalSecretName}:access`;
        const secretResponse = await nodeCurlRequest({
          request: {
            url: finalUrl,
            method: 'GET',
            headers: [
              {
                name: 'Authorization',
                value: `Bearer ${authResult.result?.accessToken}`,
              },
            ],
          },
        });
        const secretResponseBody = await secretResponse.json();
        if (secretResponse.ok) {
          const { payload } = secretResponseBody;
          const { data } = payload;
          return {
            success: true,
            result: { value: Buffer.from(data, 'base64').toString('utf-8') },
          };
        }
        return {
          success: false,
          error: { errorMessage: secretResponseBody?.error?.message, errorCode: secretResponseBody?.error?.code },
        };
      } catch (error) {
        console.error('Failed to get secret value from gcp secret manager', error);
        return {
          success: false,
          error: { errorMessage: error.toString(), errorCode: error?.code },
        };
      }
    } else {
      return {
        success: false,
        error: { errorMessage: validateResult.errorMessage, errorCode: '' },
      };
    }
  }
}
