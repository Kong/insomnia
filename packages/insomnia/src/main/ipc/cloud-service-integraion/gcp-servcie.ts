import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { GoogleAuth, type JWTInput } from 'google-auth-library';

import type { CloudProviderName } from '../../../models/cloud-credential';
import type { CloudServiceResult, GCPSecretConfig, ICloudService } from './types';

export const providerName: CloudProviderName = 'gcp';
export type GCPGetSecretConfig = Omit<GCPSecretConfig, 'secretName'>;
export class GCPService implements ICloudService {
  _keyPath: string;

  constructor(keyPath: string) {
    this._keyPath = keyPath;
  }

  _validateKeyPath(): { isValid: true; credentials: JWTInput } | { isValid: false; errorMessage: string } {
    const requiredFields = ['project_id', 'private_key_id', 'private_key', 'client_email'];
    const keyPath = this._keyPath;
    let isValid = true;
    let errorMessage = '';
    const isValidJSONStr = (strInput: string) => {
      try {
        JSON.parse(strInput);
        return true;
      } catch (error) {
        return false;
      }
    };

    try {
      const fileContent = readFileSync(keyPath, 'utf-8');
      if (isValidJSONStr(fileContent)) {
        const serviceAccountKey = JSON.parse(fileContent.toString()) as JWTInput;
        requiredFields.every(field => {
          isValid = field in serviceAccountKey;
          if (!isValid) {
            errorMessage = `Required field: ${field} is missing`;
          }
          return isValid;
        });
        if (isValid) {
          return {
            isValid: true,
            credentials: serviceAccountKey,
          };
        }
      } else {
        isValid = false;
        errorMessage = `Invalid JSON in file ${keyPath}`;
      };
    } catch (error) {
      isValid = false;
      errorMessage = error.message || error.toString();
    };
    return { isValid: false, errorMessage };
  }

  async authenticate(): Promise<CloudServiceResult<{}>> {
    const validateResult = this._validateKeyPath();
    if (validateResult.isValid) {
      const auth = new GoogleAuth({
        credentials: validateResult.credentials,
        // General scope for GCP
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
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
    } else {
      return {
        success: false,
        result: null,
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
    const { version = 'latest' } = config;
    const validateResult = this._validateKeyPath();
    if (validateResult.isValid) {
      const { credentials } = validateResult;
      const { project_id } = credentials;
      const secretClient = new SecretManagerServiceClient({
        credentials,
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
    } else {
      return {
        success: false,
        result: null,
        error: { errorMessage: validateResult.errorMessage, errorCode: '' },
      };
    }
  }
};
