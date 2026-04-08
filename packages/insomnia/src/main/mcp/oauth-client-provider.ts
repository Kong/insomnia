import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import {
  type OAuthClientInformationFull,
  OAuthClientInformationSchema,
  type OAuthClientMetadata,
  type OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import { BrowserWindow, ipcMain } from 'electron';

import { getOauthRedirectUrl } from '~/common/constants';
import type { RequestAuthentication } from '~/insomnia-data';
import { services } from '~/insomnia-data';
import { authorizeUserInDefaultBrowser } from '~/main/authorize-user-in-default-browser';
import type { ConnectionContext } from '~/main/mcp/common';
import { encryptOAuthUrl } from '~/network/o-auth-2/utils';
import { invariant } from '~/utils/invariant';

export class MCPAuthError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'MCPAuthError';
  }
}

export const isMCPAuthError = (error: unknown): error is MCPAuthError => {
  return error instanceof Error && error.name === 'MCPAuthError';
};

export class McpOAuthClientProvider implements OAuthClientProvider {
  private _codeVerifier?: string;
  private _resourceMetadataUrl?: URL;
  private _redirectEndListener: ((authorizationCode: string) => void) | null = null;
  private context: ConnectionContext;
  private authentication: RequestAuthentication;
  constructor(context: ConnectionContext) {
    this.context = context;
    const { options } = context;
    if ('authentication' in options) {
      // clone the origin authentication
      this.authentication = { ...options.authentication };
    } else {
      throw new Error('McpOAuthClientProvider requires request authentication in context');
    }
  }
  get redirectUrl() {
    return getOauthRedirectUrl();
  }
  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      client_name: 'Insomnia MCP Client',
      client_uri: 'https://github.com/Kong/insomnia',
      scope: 'scope' in this.authentication ? this.authentication.scope : undefined,
    };
  }
  private isUsingMcpAuthFlow() {
    return (
      'grantType' in this.authentication &&
      this.authentication.grantType === 'mcp_auth_flow' &&
      !this.authentication.disabled
    );
  }
  private async updateAuthentication(auth: Partial<RequestAuthentication>) {
    const mcpRequest = await services.mcpRequest.getById(this.context.requestId);
    invariant(mcpRequest, 'MCP Request not found');
    await services.mcpRequest.update(mcpRequest, {
      authentication: {
        ...mcpRequest.authentication,
        ...auth,
      },
    });
    // update local authentication copy
    this.authentication = {
      ...this.authentication,
      ...auth,
    } as RequestAuthentication;
  }
  // It's called when auth tries to get client information for authorization, use as a starting point for MCP Auth Flow
  // See: https://github.com/modelcontextprotocol/typescript-sdk/blob/1d475bb3f75674a46d81dba881ea743a763cbc12/src/client/auth.ts#L349
  async clientInformation() {
    // If not using MCP Auth Flow, wait for user to confirm in the app UI
    if (!this.isUsingMcpAuthFlow()) {
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('mcp-auth-confirmation');
      });
      await new Promise<void>((resolve, reject) => {
        ipcMain.once('mcp.authConfirmed', async (_, confirmed: boolean) => {
          if (!confirmed) {
            reject(new Error('MCP authorization cancelled by user'));
          } else {
            await this.updateAuthentication({
              type: 'oauth2',
              grantType: 'mcp_auth_flow',
              disabled: false,
            });
            resolve();
          }
        });
      });
    }
    if ('clientId' in this.authentication && this.authentication.clientId) {
      const { clientId, clientSecret, clientIdIssuedAt, clientSecretExpiresAt } = this.authentication;

      // https://github.com/modelcontextprotocol/typescript-sdk/blob/6b4d99f10b975d65392bb777cc8cb1151c20c972/packages/client/src/client/auth.ts#L223%20
      // Set client_secret to undefined if it's not set or empty string
      const parsedClientSecret = clientSecret && clientSecret.trim().length > 0 ? clientSecret : undefined;
      return {
        client_id: clientId,
        client_secret: parsedClientSecret,
        client_id_issued_at: clientIdIssuedAt,
        client_secret_expires_at: clientSecretExpiresAt,
      };
    }
    return;
  }
  async saveClientInformation(clientInformation: OAuthClientInformationFull) {
    const parsedClientInformation = OAuthClientInformationSchema.parse(clientInformation);
    await this.updateAuthentication({
      clientId: parsedClientInformation.client_id,
      clientSecret: parsedClientInformation.client_secret,
      clientIdIssuedAt: parsedClientInformation.client_id_issued_at,
      clientSecretExpiresAt: parsedClientInformation.client_secret_expires_at,
    });
  }
  async tokens(): Promise<OAuthTokens | undefined> {
    // Don't return tokens if not using MCP Auth Flow or if disabled
    if (this.isUsingMcpAuthFlow()) {
      const token = await services.oAuth2Token.getOrCreateByParentId(this.context.requestId);
      if (token.accessToken) {
        return {
          access_token: token.accessToken,
          refresh_token: token.refreshToken,
          id_token: token.identityToken,
          expires_in: token.expiresAt ? Math.floor(token.expiresAt / 1000) : undefined,
          token_type: ('tokenPrefix' in this.authentication && this.authentication.tokenPrefix) || 'Bearer',
        };
      }
    }
    return undefined;
  }
  async saveTokens(tokens: OAuthTokens) {
    const token = await services.oAuth2Token.getOrCreateByParentId(this.context.requestId);
    await services.oAuth2Token.update(token, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || '',
      identityToken: tokens.id_token || '',
      expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
    });
    await this.updateAuthentication({
      tokenPrefix: tokens.token_type,
    });
  }
  // add state parameter to authorization url if present in authentication
  async state() {
    if ('state' in this.authentication && this.authentication.state) {
      return this.authentication.state;
    }
    return '';
  }
  saveResourceMetadataUrl(url: URL | undefined) {
    this._resourceMetadataUrl = url;
  }
  get resourceMetadataUrl() {
    return this._resourceMetadataUrl;
  }
  async redirectToAuthorization(authorizationUrl: URL) {
    if (this.context.abortController.signal.aborted) {
      throw new Error('MCP Connection aborted');
    }
    const { relayUrl, decryptOAuthResult } = encryptOAuthUrl(authorizationUrl.toString());
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('show-oauth-authorization-modal', relayUrl);
    });
    const redirectedResult = await authorizeUserInDefaultBrowser({
      url: relayUrl,
    });
    const redirectedTo = decryptOAuthResult(redirectedResult);
    const redirectParams = Object.fromEntries(new URL(redirectedTo).searchParams);
    const { code: authorizationCode, error, error_description, error_uri } = redirectParams;
    if (error) {
      throw new Error(JSON.stringify({ error, error_description, error_uri }));
    } else if (!authorizationCode) {
      throw new Error('Authorization code not found');
    }
    await this._redirectEndListener?.(authorizationCode);
  }
  onRedirectEnd(listener: (authorizationCode: string) => void) {
    this._redirectEndListener = listener;
    return () => {
      this._redirectEndListener = null;
    };
  }
  async saveCodeVerifier(codeVerifier: string) {
    this._codeVerifier = codeVerifier;
  }
  async codeVerifier() {
    if (!this._codeVerifier) {
      throw new Error('Code verifier not set');
    }
    return this._codeVerifier;
  }
}
