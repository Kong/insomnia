import crypto from 'node:crypto';

import { type AuthenticationResult, AuthError, CryptoProvider, PublicClientApplication } from '@azure/msal-node';

import { INSOMNIA_AZURE_CLIENT_ID, INSOMNIA_AZURE_REDIRECT_URI } from '../../../common/constants';
import { insomniaFetch } from '../../../ui/insomniaFetch';
import { nodeCurlRequest } from './request';
import { type CloudServiceResult, type ICloudService, OAuthCloudService } from './types';

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

// singleton azure client instance
let azureClient: PublicClientApplication;
let redirect_uri: string;
let verifier: string;
let challenge: string;
export const scopes = ['https://vault.azure.net/user_impersonation'];
export const azureEndpointHost = 'https://login.microsoftonline.com';
export const authority = `${azureEndpointHost}/common`;

const getAzureConfig = async () => {
  // Validate and use the environment variables if provided for dev mode
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

  // Get Azure config from server
  return insomniaFetch<{ clientID: string; clientRedirectURI: string; error?: string }>({
    path: '/v1/oauth/azure/config',
    method: 'GET',
    sessionId: '',
  }).then(data => {
    const { clientID, clientRedirectURI } = data;
    if (clientID && clientRedirectURI) {
      return {
        clientId: clientID,
        redirectUri: clientRedirectURI,
      };
    }
    throw new Error(`Can not get Azure config from server ${data}`);
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

export class AzureService extends OAuthCloudService implements ICloudService {
  private _credential: AuthenticationResult;

  constructor(credential: AuthenticationResult) {
    super();
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
    return authUrl;
  }

  static async exchangeCode({ code }: { code: string }): Promise<CloudServiceResult<AuthenticationResult>> {
    const azureClient = await getAzureClient();
    try {
      const authResult = await azureClient.acquireTokenByCode({
        scopes,
        redirectUri: redirect_uri,
        code,
        codeVerifier: verifier,
      });
      // generate new Pkce codes after a success auth
      await generatePkceCodes();
      return {
        success: true,
        result: authResult,
      };
    } catch (error) {
      if (error instanceof AuthError) {
        const { errorMessage, errorCode } = error;
        return {
          success: false,
          result: null,
          error: { errorMessage, errorCode },
        };
      }
      return {
        success: false,
        result: null,
        error: { errorMessage: error.toString(), errorCode: '' },
      };
    }
  }

  async authenticate() {
    // This method is not implemented as Azure utilizes OAuth authentication flow.
  }

  getUniqueCacheKey(identifier: string, _config?: any) {
    const uniqueKey = identifier;
    const uniqueKeyHash = crypto.createHash('md5').update(uniqueKey).digest('hex');
    return uniqueKeyHash;
  }

  async getSecret(identifier: string): Promise<CloudServiceResult<AzureSecretResponse>> {
    const { accessToken } = this._credential;
    const apiVersion = '7.4';
    // Using Azure rest api to get secret. Refer:
    // https://learn.microsoft.com/en-us/rest/api/keyvault/secrets/get-secret/get-secret?view=rest-keyvault-secrets-7.4&tabs=HTTP
    try {
      const params = new URLSearchParams({
        'api-version': apiVersion,
      });
      const secretUrl = `${identifier}?${params.toString()}`;
      const secretResponse = await nodeCurlRequest({
        request: {
          url: secretUrl,
          method: 'GET',
          headers: [
            {
              name: 'Authorization',
              value: `Bearer ${accessToken}`,
            },
          ],
        },
      });
      if (secretResponse.ok) {
        const secretBody = (await secretResponse.json()) as AzureSecretResponse;
        return {
          success: true,
          result: secretBody,
        };
      }
      let errorBody;
      const contentType = secretResponse.headers.find(h => h.name.toLocaleLowerCase() === 'content-type')?.value;
      if (contentType?.toLowerCase().includes('application/json')) {
        errorBody = secretResponse.json() as { error?: { code: string; message: string } };
      } else {
        errorBody = secretResponse.body;
      }
      const errorMessage =
        (typeof errorBody === 'object' && errorBody.error?.message) ||
        secretResponse.status ||
        'Unknown error, failed to get secret';
      return {
        success: false,
        result: null,
        error: { errorMessage, errorCode: secretResponse.status },
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: { errorMessage: error.toString(), errorCode: '' },
      };
    }
  }
}
