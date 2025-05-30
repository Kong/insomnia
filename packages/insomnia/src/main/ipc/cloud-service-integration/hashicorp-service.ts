import crypto from 'node:crypto';

import {
  type CloudProviderName,
  type HashiCorpCredentials,
  HashiCorpCredentialType,
  HashiCorpVaultAuthMethod,
  type HCPCredential,
} from '../../../models/cloud-credential';
import { nodeCurlRequest, type NodeCurlResponseType } from './request';
import type {
  CloudServiceResult,
  HashiCorpSecretConfig,
  HashiCorpVaultKVV1SecretConfig,
  HashiCorpVaultKVV2SecretConfig,
  HCPSecretConfig,
  ICloudService,
} from './types';

export interface AuthenticateResult {
  access_token: string;
  expires_at: number;
}
export interface HCPAccessTokenResponse {
  access_token: string;
  expires_in: number;
}
export interface HashiCorpOnPremTokenReponse {
  auth: {
    client_token: string;
    lease_duration: number;
  };
}
export interface HashiCorpVaultKVV1SecretValue {
  data: Record<string, any>;
}
export interface HashiCorpVaultKVV2SecretValue {
  data: {
    data: Record<string, any>;
    metadata: {
      version: string | number;
    };
  };
}
export interface HCPStaticSecretValue {
  value: any;
  version: string | number;
}
export interface HCPStaticSecretResultWithoutVersion {
  secret: {
    name: string;
    latest_version: string | number;
    static_version: HCPStaticSecretValue;
  };
}
export interface HCPStaticSecretResultWithVersion {
  static_version: HCPStaticSecretValue;
}
export type HashiCorpGetSecretValue =
  | HashiCorpVaultKVV1SecretValue
  | HashiCorpVaultKVV2SecretValue
  | HCPStaticSecretValue;

const hcp_auth_url = 'https://auth.idp.hashicorp.com';
const hcp_api_url = 'https://api.cloud.hashicorp.com';
const hcp_api_version = '2023-11-28';
const neverExpireTokenTTL = 0;
export const providerName: CloudProviderName = 'hashicorp';
export class HashiCorpService implements ICloudService {
  private _credential: HashiCorpCredentials;

  constructor(credential: HashiCorpCredentials) {
    this._credential = credential;
  }

  async _parseResponseError(response: NodeCurlResponseType) {
    const { type } = this._credential;
    const errorDetail = { errorMessage: '', errorCode: '' };
    let errorBody;
    try {
      errorBody = response.json();
    } catch (error) {
      errorBody = response.body;
    }
    try {
      if (typeof errorBody === 'object') {
        if (type === HashiCorpCredentialType.cloud) {
          const { message, details, error_description } = errorBody;
          let errorMessage = message as string;
          if (Array.isArray(details) && details.length > 0) {
            errorMessage = `${errorMessage} Details: ${details.join(' ')}`;
          }
          if (error_description) {
            errorMessage = error_description;
          }
          errorDetail.errorMessage = errorMessage || JSON.stringify(errorBody);
        } else {
          const { errors } = errorBody;
          if (errors && Array.isArray(errors)) {
            errorDetail.errorMessage = errors.length > 0 ? errors.join(',') : response.status;
          } else {
            errorDetail.errorMessage = JSON.stringify(errorBody);
          }
        }
      } else {
        errorDetail.errorMessage = errorBody.toString();
      }
    } catch (error) {
      errorDetail.errorMessage = error.toString() || response.status;
    }
    return {
      success: false,
      result: null,
      error: errorDetail,
    };
  }

  async authenticate(): Promise<CloudServiceResult<AuthenticateResult>> {
    const { type } = this._credential;
    const timeNow = Date.now();
    try {
      if (type === HashiCorpCredentialType.cloud) {
        const { client_id, client_secret } = this._credential as HCPCredential;
        const formData = [
          {
            key: 'client_id',
            value: client_id,
          },
          {
            key: 'client_secret',
            value: client_secret,
          },
          {
            key: 'grant_type',
            value: 'client_credentials',
          },
          {
            key: 'audience',
            value: hcp_api_url,
          },
        ];
        // authenticate to HashiCorp Cloud Platform
        const authResponse = await nodeCurlRequest({
          request: {
            url: `${hcp_auth_url}/oauth2/token`,
            method: 'POST',
            headers: [
              {
                name: 'Content-Type',
                value: 'application/x-www-form-urlencoded',
              },
            ],
            body: {
              mimeType: 'application/x-www-form-urlencoded',
              params: formData.map(param => ({ name: param.key, value: param.value })),
            },
          },
        });
        if (authResponse.ok) {
          const authResponseBody = authResponse.json() as HCPAccessTokenResponse;
          const { access_token, expires_in } = authResponseBody;
          return {
            success: true,
            result: {
              access_token,
              expires_at: timeNow + expires_in * 1000,
            },
          };
        }
        const errorResult = await this._parseResponseError(authResponse);
        return errorResult;
      }
      const { authMethod, serverAddress } = this._credential;
      const finalUrl = serverAddress.endsWith('/')
        ? serverAddress.slice(0, Math.max(0, serverAddress.length - 1))
        : serverAddress;
      if (authMethod === HashiCorpVaultAuthMethod.appRole) {
        const { role_id, secret_id } = this._credential;

        // authenticate to on-prem deployement with app role
        const authResponse = await nodeCurlRequest({
          request: {
            url: `${finalUrl}/v1/auth/approle/login`,
            method: 'POST',
            headers: [
              {
                name: 'Content-Type',
                value: 'application/json',
              },
            ],
            body: {
              mimeType: 'text/plain',
              text: JSON.stringify({
                role_id,
                secret_id,
              }),
            },
          },
        });
        if (authResponse.ok) {
          const authResponseBody = authResponse.json() as HashiCorpOnPremTokenReponse;
          const { auth } = authResponseBody;
          const { client_token, lease_duration } = auth;
          return {
            success: true,
            result: {
              access_token: client_token,
              expires_at: timeNow + lease_duration * 1000,
            },
          };
        }
        const errorResult = await this._parseResponseError(authResponse);
        return errorResult;
      } else if (authMethod === HashiCorpVaultAuthMethod.token) {
        const { access_token } = this._credential;

        // authenticate to on-prem deployment with token
        const authResponse = await nodeCurlRequest({
          request: {
            url: `${finalUrl}/v1/auth/token/lookup-self`,
            method: 'GET',
            headers: [
              {
                name: 'X-Vault-Token',
                value: access_token,
              },
            ],
          },
        });
        if (authResponse.ok) {
          const authResponseBody = await authResponse.json();
          const { data } = authResponseBody as { data: { ttl: number } };
          const { ttl } = data;
          return {
            success: true,
            result: {
              access_token,
              // ttl 0 means the token never expires like root token
              expires_at: ttl === neverExpireTokenTTL ? neverExpireTokenTTL : timeNow + ttl * 1000,
            },
          };
        }
        const errorResult = await this._parseResponseError(authResponse);
        return errorResult;
      }
      return {
        success: false,
        result: null,
        error: { errorMessage: `Invalid type ${type} with authMethod ${authMethod} for HashiCorp`, errorCode: '' },
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: { errorMessage: error.toString(), errorCode: '' },
      };
    }
  }

  getUniqueCacheKey(secretName: string, config?: HashiCorpSecretConfig) {
    const defaultUniqueKeyHash = crypto.createHash('md5').update(secretName).digest('hex');
    if (!config) {
      return defaultUniqueKeyHash;
    }
    const { type } = this._credential;
    if (type === HashiCorpCredentialType.cloud) {
      const { type, organizationId, projectId, appName, version } = config as HCPSecretConfig;
      const uniqueKey = `${providerName}:${organizationId}:${projectId}:${appName}:${type}:${secretName}:${version || 'latest'}`;
      const uniqueKeyHash = crypto.createHash('md5').update(uniqueKey).digest('hex');
      return uniqueKeyHash;
    }
    const { kvVersion, secretEnginePath } = config as HashiCorpVaultKVV1SecretConfig | HashiCorpVaultKVV2SecretConfig;
    switch (kvVersion) {
      case 'v1': {
        const uniqueKeyV1 = `${providerName}:${secretEnginePath}:${secretName}`;
        const uniqueKeyHashV1 = crypto.createHash('md5').update(uniqueKeyV1).digest('hex');
        return uniqueKeyHashV1;
      }
      case 'v2': {
        const { version } = config as HashiCorpVaultKVV2SecretConfig;
        const uniqueKeyV2 = `${providerName}:${secretEnginePath}:${secretName}:${version || 'latest'}`;
        const uniqueKeyHashV2 = crypto.createHash('md5').update(uniqueKeyV2).digest('hex');
        return uniqueKeyHashV2;
      }
      default: {
        return defaultUniqueKeyHash;
      }
    }
  }

  async getSecret(
    secretName: string,
    config: HashiCorpSecretConfig,
  ): Promise<CloudServiceResult<HashiCorpGetSecretValue>> {
    const { type, access_token } = this._credential;
    try {
      if (type === HashiCorpCredentialType.onPrem) {
        // on-prem vault
        const { serverAddress } = this._credential;
        const finalUrl = serverAddress.endsWith('/')
          ? serverAddress.slice(0, Math.max(0, serverAddress.length - 1))
          : serverAddress;
        const { kvVersion, secretEnginePath } = config as
          | HashiCorpVaultKVV1SecretConfig
          | HashiCorpVaultKVV2SecretConfig;
        if (kvVersion === 'v1') {
          const secretResponse = await nodeCurlRequest({
            request: {
              url: `${finalUrl}/v1/${secretEnginePath}/metadata/${secretName}`,
              method: 'GET',
              headers: [
                {
                  name: 'X-Vault-Token',
                  value: access_token!,
                },
              ],
            },
          });
          if (secretResponse.ok) {
            const secretResponseBody = (await secretResponse.json()) as HashiCorpVaultKVV1SecretValue;
            return {
              success: true,
              result: secretResponseBody,
            };
          }
          const errorResult = await this._parseResponseError(secretResponse);
          return errorResult;
        }
        // kv version v2
        const { version } = config as HashiCorpVaultKVV2SecretConfig;
        let v2Url = `${finalUrl}/v1/${secretEnginePath}/data/${secretName}`;
        if (version) {
          // add version url params
          const urlObj = new URL(v2Url);
          urlObj.searchParams.append('version', version.toString());
          v2Url = urlObj.toString();
        }
        const secretResponse = await nodeCurlRequest({
          request: {
            url: v2Url,
            method: 'GET',
            headers: [
              {
                name: 'X-Vault-Token',
                value: access_token!,
              },
            ],
          },
        });
        if (secretResponse.ok) {
          const secretResponseBody = (await secretResponse.json()) as HashiCorpVaultKVV2SecretValue;
          return {
            success: true,
            result: secretResponseBody,
          };
        }
        const errorResult = await this._parseResponseError(secretResponse);
        return errorResult;
      }
      // cloud vault
      const { organizationId, projectId, appName, version } = config as HCPSecretConfig;
      const secretRequestBaseUrl = `${hcp_api_url}/secrets/${hcp_api_version}/organizations/${organizationId}/projects/${projectId}/apps/${appName}/secrets/${secretName}`;
      const secretRequestUrl = version
        ? `${secretRequestBaseUrl}/versions/${version}:open`
        : `${secretRequestBaseUrl}:open`;
      const secretResponse = await nodeCurlRequest({
        request: {
          url: secretRequestUrl,
          method: 'GET',
          headers: [
            {
              name: 'Authorization',
              value: `Bearer ${access_token}`,
            },
          ],
        },
      });
      if (secretResponse.ok) {
        const secretResponseBody = await secretResponse.json();
        let secretResult: HCPStaticSecretValue;
        if (version) {
          const { static_version } = secretResponseBody as HCPStaticSecretResultWithVersion;
          secretResult = static_version;
        } else {
          const { secret } = secretResponseBody as HCPStaticSecretResultWithoutVersion;
          secretResult = secret.static_version;
        }
        return {
          success: true,
          result: secretResult,
        };
      }
      const errorResult = await this._parseResponseError(secretResponse);
      return errorResult;
    } catch (error) {
      return {
        success: false,
        result: null,
        error: { errorMessage: error.toString(), errorCode: '' },
      };
    }
  }
}
