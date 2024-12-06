import { type AuthenticationResult, CryptoProvider, PublicClientApplication } from '@azure/msal-node';
import crypto from 'crypto';
import { net, shell } from 'electron';

import { INSOMNIA_AZURE_CLIENT_ID, INSOMNIA_AZURE_REDIRECT_URI, INSOMNIA_FETCH_TIME_OUT } from '../../../common/constants';
import { insomniaFetch } from '../../../ui/insomniaFetch';
import type { CloudServiceResult, ICloudService } from './types';

export type AzureVaultType = 'key' | 'secret';
export interface AzureGetSecretConfig {
  type: AzureVaultType;
}
interface AzureSecretAttributes {
  enabled: boolean;
  created: number;
  updated: number;
  exportable: boolean;
}
export interface AzureKeyObjectResponse extends AzureSecretAttributes {
  key: JsonWebKey;
}
export interface AzureSecretObjectResponse extends AzureSecretAttributes {
  value: string;
  contentType: string;
  id: string;
}
export type AzureSecretResponse = AzureKeyObjectResponse | AzureSecretObjectResponse;

// singeleton azure client instance
let azureClient: PublicClientApplication;
let redirect_uri: string;
let verifier: string;
let challenge: string;
export const scopes = ['https://vault.azure.net/user_impersonation'];
export const azureEndpointHost = 'https://login.microsoftonline.com';
export const authority = `${azureEndpointHost}/common`;

const getAzureConfig = async () => {
  // Validate and use the environment variables if provided
  if (
    (INSOMNIA_AZURE_REDIRECT_URI && !INSOMNIA_AZURE_CLIENT_ID) ||
    (!INSOMNIA_AZURE_REDIRECT_URI && INSOMNIA_AZURE_CLIENT_ID)
  ) {
    throw new Error('Azure Client ID and Redirect URI must both be set.');
  }

  if (INSOMNIA_AZURE_CLIENT_ID && INSOMNIA_AZURE_REDIRECT_URI) {
    return {
      clientId: INSOMNIA_AZURE_CLIENT_ID,
      redirectUri: INSOMNIA_AZURE_REDIRECT_URI,
    };
  }

  // TODO Get Azure config from server
  return insomniaFetch<{ applicationId: string; redirectUri: string; error?: string }>({
    path: '/v1/oauth/azure/config',
    method: 'GET',
    sessionId: '',
  }).then(data => {
    return {
      clientId: data.applicationId,
      redirectUri: data.redirectUri,
    };
  });
};

const getAzureClient = async () => {
  if (!azureClient) {
    const azureConfig = await getAzureConfig();
    const { clientId, redirectUri } = azureConfig;
    azureClient = new PublicClientApplication({
      auth: {
        clientId,
        authority,
      },
    });
    redirect_uri = redirectUri;
  }
  return azureClient;
};

const generatePkceCodes = async () => {
  const crypoProvider = new CryptoProvider();
  ({ verifier, challenge } = await crypoProvider.generatePkceCodes());
};
// generate Pkce Code on initialize
generatePkceCodes();

export class AzureService implements ICloudService {
  _credential: AuthenticationResult;

  constructor(credential: AuthenticationResult) {
    this._credential = credential;
  }

  static async openAuthUrl() {
    const azureClient = await getAzureClient();
    const authUrl = await azureClient.getAuthCodeUrl({
      redirectUri: redirect_uri,
      scopes,
      codeChallenge: challenge,
      codeChallengeMethod: 'S256',
    });
    // eslint-disable-next-line no-restricted-properties
    shell.openExternal(authUrl);
  }

  async authorize(code: string): Promise<CloudServiceResult<AuthenticationResult>> {
    const azureClient = await getAzureClient();
    try {
      const authResult = await azureClient.acquireTokenByCode({
        scopes,
        redirectUri: redirect_uri,
        code,
        codeVerifier: verifier,
      });
      // generate new Pkce codes after a sucess auth
      await generatePkceCodes();
      return {
        success: true,
        result: authResult,
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.toString(),
      };
    }
  };

  async getSecret(identifier: string): Promise<CloudServiceResult<AzureSecretResponse>> {
    const { accessToken } = this._credential;
    const apiVersion = '7.4';
    // Using Azure rest api to get key/secret. Refer:
    // https://learn.microsoft.com/en-us/rest/api/keyvault/keys/get-key/get-key?view=rest-keyvault-keys-7.4&tabs=HTTP
    // https://learn.microsoft.com/en-us/rest/api/keyvault/secrets/get-secret/get-secret?view=rest-keyvault-secrets-7.4&tabs=HTTP
    try {
      const params = new URLSearchParams({
        'api-version': apiVersion,
      });
      const secretUrl = `${identifier}?${params.toString()}`;
      const requestConfig: RequestInit = {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(INSOMNIA_FETCH_TIME_OUT),
      };
      const secretResponse = await net.fetch(secretUrl, requestConfig);
      if (secretResponse.ok) {
        const secretBody = await secretResponse.json() as AzureSecretResponse;
        return {
          success: true,
          result: secretBody,
        };
      } else {
        return {
          success: false,
          result: null,
        };
      }
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.toString(),
      };
    }
  }

  getUniqueCacheKey(identifier: string) {
    const uniqueKey = identifier;
    const uniqueKeyHash = crypto.createHash('md5').update(uniqueKey).digest('hex');
    return uniqueKeyHash;
  }
}
