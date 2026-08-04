import crypto from 'node:crypto';
import querystring from 'node:querystring';

import { BrowserWindow } from 'electron';
import type {
  AuthTypeOAuth2,
  OAuth2ResponseType,
  OAuth2Token,
  Request,
  RequestGroup,
  RequestHeader,
  RequestParameter,
  Response,
  ResponseTimelineEntry,
} from 'insomnia-data';
import { database as db, models, services } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

import { invariant } from '~/common/utils/invariant';
import { setDefaultProtocol } from '~/common/utils/url/protocol';
import { authorizeUserInDefaultBrowser } from '~/main/authorize-user-in-default-browser';
import { authorizeUserInWindow } from '~/main/authorize-user-in-window';
import { getElectronStorage as getSharedElectronStorage } from '~/main/electron-storage';

import { getOauthRedirectUrl, getOauthRelayUrl, OAUTH_WINDOW_SESSION_ID_KEY } from '../../../common/constants';
import { type DefaultBrowserRedirectParam, escapeRegex } from '../../../common/misc';
import { getAuthObjectOrNull, isAuthEnabled } from '../../../network/authentication';
import { getBasicAuthHeader } from '../../../network/basic-auth/get-header';
import {
  fetchMcpRequestData,
  fetchRequestData,
  fetchRequestGroupData,
  responseTransform,
  sendCurlAndWriteTimeline,
  tryToInterpolateRequest,
  tryToTransformRequestWithPlugins,
} from '../../../network/network';

const { isRequestGroup, isRequestGroupId } = models.requestGroup;

export const GRANT_TYPE_AUTHORIZATION_CODE = 'authorization_code';
export const GRANT_TYPE_IMPLICIT = 'implicit';
export const GRANT_TYPE_PASSWORD = 'password';
export const GRANT_TYPE_CLIENT_CREDENTIALS = 'client_credentials';
export const GRANT_TYPE_REFRESH = 'refresh_token';
export const GRANT_TYPE_MCP_AUTH_FLOW = 'mcp_auth_flow';
export type AuthKeys =
  | 'access_token'
  | 'id_token'
  | 'client_id'
  | 'client_secret'
  | 'audience'
  | 'resource'
  | 'code_challenge'
  | 'code_challenge_method'
  | 'code_verifier'
  | 'code'
  | 'nonce'
  | 'error'
  | 'error_description'
  | 'error_uri'
  | 'expires_in'
  | 'grant_type'
  | 'password'
  | 'redirect_uri'
  | 'refresh_token'
  | 'response_type'
  | 'scope'
  | 'state'
  | 'token_type'
  | 'username'
  | 'xError'
  | 'xResponseId';
export const PKCE_CHALLENGE_S256 = 'S256';
export const PKCE_CHALLENGE_PLAIN = 'plain';

export type OAuth2AuthorizationStatusType = 'none' | 'getting_code' | 'getting_token';

const showOAuthAuthorizationModal = (authCodeUrlStr: string) => {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('show-oauth-authorization-modal', authCodeUrlStr);
  });
};

const hideOAuthAuthorizationModal = () => {
  BrowserWindow.getAllWindows().forEach(window => {
    window.webContents.send('hide-oauth-authorization-modal');
  });
};
const getElectronStorage = () => {
  return getSharedElectronStorage();
};

export function initNewOAuthSession() {
  const authWindowSessionId = `persist:oauth2_${uuidv4()}`;
  const storage = getElectronStorage();
  storage.setItem(OAUTH_WINDOW_SESSION_ID_KEY, authWindowSessionId);
  return authWindowSessionId;
}

export function getOAuthSession(): string {
  const storage = getElectronStorage();
  const token = storage.getItem(OAUTH_WINDOW_SESSION_ID_KEY);
  return token || initNewOAuthSession();
}

export const encryptOAuthUrl = (authCodeUrlStr: string) => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const relayUrl = `${getOauthRelayUrl()}?authCodeUrl=${encodeURIComponent(authCodeUrlStr)}&publicKey=${encodeURIComponent(publicKey)}`;

  const decryptOAuthResult = (result: DefaultBrowserRedirectParam): string => {
    if ('redirectUrl' in result) {
      return result.redirectUrl;
    }

    const { encryptedRedirectUrl, encryptedKey, iv } = result;
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(encryptedKey, 'base64'),
    );
    const encryptedBuf = Buffer.from(encryptedRedirectUrl, 'base64');
    const authTag = encryptedBuf.slice(-16);
    const ciphertext = encryptedBuf.slice(0, -16);
    // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, Buffer.from(iv, 'base64'), {
      authTagLength: 16,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    return decrypted;
  };

  return {
    relayUrl,
    decryptOAuthResult,
  };
};

export interface OAuth2TokenResult {
  token?: OAuth2Token;
  timeline: ResponseTimelineEntry[];
}

const logEntry = (value: string): ResponseTimelineEntry => ({
  name: 'Text',
  value: `[oauth2] ${value}`,
  timestamp: Date.now(),
});

export const getOAuth2Token = async (
  requestId: string,
  authentication: AuthTypeOAuth2,
  forceRefresh = false,
): Promise<OAuth2TokenResult> => {
  const timeline: ResponseTimelineEntry[] = [];
  try {
    if (authentication.grantType === 'mcp_auth_flow') {
      return { token: undefined, timeline };
    }
    timeline.push(
      logEntry(`Starting OAuth2 flow (grantType=${authentication.grantType}, forceRefresh=${forceRefresh})`),
    );
    const { oAuth2Token, closestAuthId, refreshTimeline } = await getExistingAccessTokenAndRefreshIfExpired(
      requestId,
      authentication,
      forceRefresh,
    );
    if (refreshTimeline) {
      timeline.push(...refreshTimeline);
    }
    if (oAuth2Token?.accessToken) {
      timeline.push(
        logEntry(
          `Using existing access token (expires: ${oAuth2Token.expiresAt ? new Date(oAuth2Token.expiresAt).toISOString() : 'never'}, token: ${oAuth2Token.accessToken.slice(0, 8)}...)`,
        ),
      );
      return { token: oAuth2Token, timeline };
    }
    const validGrantType = ['implicit', 'authorization_code', 'password', 'client_credentials'].includes(
      authentication.grantType,
    );
    invariant(validGrantType, `Invalid grant type ${authentication.grantType}`);
    if (authentication.grantType === 'implicit') {
      invariant(authentication.authorizationUrl, 'Missing authorization URL');
      const responseTypeOrFallback = authentication.responseType || 'token';
      const hasNonce = responseTypeOrFallback === 'id_token token' || responseTypeOrFallback === 'id_token';
      const implicitUrl = new URL(authentication.authorizationUrl);
      [
        { name: 'response_type', value: responseTypeOrFallback },
        { name: 'client_id', value: authentication.clientId },
        ...insertAuthKeyIf('redirect_uri', authentication.redirectUrl),
        ...insertAuthKeyIf('scope', authentication.scope),
        ...insertAuthKeyIf('state', authentication.state),
        ...insertAuthKeyIf('audience', authentication.audience),
        ...(hasNonce
          ? [
              {
                name: 'nonce',
                value: Math.floor(Math.random() * 9_999_999_999_999) + 1 + '',
              },
            ]
          : []),
      ].forEach(p => p.value && implicitUrl.searchParams.append(p.name, p.value));
      timeline.push(logEntry(`Opening authorization window: ${implicitUrl.origin}${implicitUrl.pathname}`));
      let redirectedTo: string;
      try {
        redirectedTo = await authorizeUserInWindow({
          url: implicitUrl.toString(),
          urlSuccessRegex: /(access_token=|id_token=)/,
          urlFailureRegex: /(error=)/,
          sessionId: getOAuthSession(),
        });
      } catch (err) {
        timeline.push(logEntry(`Authorization window error: ${err.message}`));
        throw err;
      }
      console.log('[oauth2] Detected redirect ' + redirectedTo);
      timeline.push(logEntry(`Authorization redirect detected`));

      const responseUrl = new URL(redirectedTo);
      if (responseUrl.searchParams.has('error')) {
        const params = Object.fromEntries(responseUrl.searchParams);
        timeline.push(
          logEntry(`Authorization error: ${params.error} - ${params.error_description || 'no description'}`),
        );
        const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
        const token = await services.oAuth2Token.update(old, transformNewAccessTokenToOauthModel(params));
        return { token, timeline };
      }
      const hash = responseUrl.hash.slice(1);
      invariant(hash, 'No hash found in response URL from OAuth2 provider');
      const data = Object.fromEntries(new URLSearchParams(hash));
      timeline.push(logEntry('Received implicit token successfully'));
      const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
      const token = await services.oAuth2Token.update(
        old,
        transformNewAccessTokenToOauthModel({
          ...data,
          access_token: data.access_token || data.id_token,
        }),
      );
      return { token, timeline };
    }
    invariant(authentication.accessTokenUrl, 'Missing access token URL');
    let params: RequestHeader[] = [];
    if (authentication.grantType === 'authorization_code') {
      invariant(authentication.authorizationUrl, 'Invalid authorization URL');

      const pkceMethod =
        authentication.usePkce && !authentication.pkceMethod ? PKCE_CHALLENGE_S256 : authentication.pkceMethod;
      const codeVerifier = authentication.usePkce ? encodePKCE(crypto.randomBytes(32)) : '';
      const codeChallenge =
        authentication.usePkce && pkceMethod === PKCE_CHALLENGE_S256
          ? encodePKCE(crypto.createHash('sha256').update(codeVerifier).digest())
          : codeVerifier;
      const authCodeUrl = new URL(authentication.authorizationUrl);
      const responseType: OAuth2ResponseType = 'code';
      const redirectUrl = authentication.useDefaultBrowser ? getOauthRedirectUrl() : authentication.redirectUrl;
      [
        { name: 'response_type', value: responseType },
        { name: 'client_id', value: authentication.clientId },
        ...insertAuthKeyIf('redirect_uri', redirectUrl),
        ...insertAuthKeyIf('scope', authentication.scope),
        ...insertAuthKeyIf('state', authentication.state),
        ...insertAuthKeyIf('audience', authentication.audience),
        ...insertAuthKeyIf('resource', authentication.resource),
        ...(codeChallenge
          ? [
              { name: 'code_challenge', value: codeChallenge },
              { name: 'code_challenge_method', value: pkceMethod },
            ]
          : []),
      ].forEach(p => p.value && authCodeUrl.searchParams.append(p.name, p.value));

      let redirectedTo: string | null = null;
      if (authentication.useDefaultBrowser) {
        timeline.push(logEntry(`Opening default browser for authorization: ${authCodeUrl.toString()}`));
        const authCodeUrlStr = authCodeUrl.toString();
        const { relayUrl, decryptOAuthResult } = encryptOAuthUrl(authCodeUrlStr);

        showOAuthAuthorizationModal(relayUrl);
        try {
          const result = await authorizeUserInDefaultBrowser({
            url: relayUrl,
          });
          redirectedTo = decryptOAuthResult(result);
        } catch (err) {
          timeline.push(logEntry(`Default browser authorization error: ${err.message}`));
          throw err;
        } finally {
          hideOAuthAuthorizationModal();
        }
      } else {
        timeline.push(logEntry(`Opening authorization window: ${authCodeUrl.toString()}`));
        try {
          redirectedTo = await authorizeUserInWindow({
            url: authCodeUrl.toString(),
            urlSuccessRegex: authentication.redirectUrl
              ? new RegExp(`${escapeRegex(authentication.redirectUrl)}.*([?&]code=)`, 'i')
              : /([?&]code=)/i,
            urlFailureRegex: authentication.redirectUrl
              ? new RegExp(`${escapeRegex(authentication.redirectUrl)}.*([?&]error=)`, 'i')
              : /([?&]error=)/i,
            sessionId: getOAuthSession(),
          });
        } catch (err) {
          timeline.push(logEntry(`Authorization window error: ${err.message}`));
          throw err;
        }
      }

      console.log('[oauth2] Detected redirect ' + redirectedTo);
      timeline.push(
        logEntry(`Authorization redirect detected: ${redirectedTo}`),
        logEntry('Exchanging code for token'),
      );
      const redirectParams = Object.fromEntries(new URL(redirectedTo).searchParams);
      if (redirectParams.error) {
        const code = redirectParams.error;
        const msg = redirectParams.error_description;
        const uri = redirectParams.error_uri;
        timeline.push(logEntry(`Authorization error: ${code} - ${msg || 'no description'}`));
        throw new Error(`OAuth 2.0 Error ${code}\n\n${msg}\n\n${uri}`);
      }
      console.log('[oauth2] Detected code ' + redirectParams.code);
      params = [
        { name: 'grant_type', value: GRANT_TYPE_AUTHORIZATION_CODE },
        { name: 'code', value: redirectParams.code },
        ...insertAuthKeyIf('redirect_uri', redirectUrl),
        ...insertAuthKeyIf('audience', authentication.audience),
        ...insertAuthKeyIf('resource', authentication.resource),
        ...insertAuthKeyIf('code_verifier', codeVerifier),
      ];
    } else if (authentication.grantType === 'password') {
      params = [
        { name: 'grant_type', value: 'password' },
        ...insertAuthKeyIf('username', authentication.username),
        ...insertAuthKeyIf('password', authentication.password),
        ...insertAuthKeyIf('scope', authentication.scope),
        ...insertAuthKeyIf('audience', authentication.audience),
      ];
    } else if (authentication.grantType === 'client_credentials') {
      params = [
        { name: 'grant_type', value: 'client_credentials' },
        ...insertAuthKeyIf('scope', authentication.scope),
        ...insertAuthKeyIf('audience', authentication.audience),
        ...insertAuthKeyIf('resource', authentication.resource),
      ];
    }
    const headers = authentication.origin ? [{ name: 'Origin', value: authentication.origin }] : [];
    if (authentication.credentialsInBody) {
      params = [
        ...params,
        ...insertAuthKeyIf('client_id', authentication.clientId),
        ...insertAuthKeyIf('client_secret', authentication.clientSecret),
      ];
    } else {
      headers.push(getBasicAuthHeader(authentication.clientId, authentication.clientSecret));
    }

    timeline.push(logEntry(`Sending token request to ${authentication.accessTokenUrl}`));
    const response = await sendAccessTokenRequest(requestId, authentication, params, headers);
    const responseTimeline = await services.helpers.getResponseTimeline(response, true);
    timeline.push(
      logEntry('--- token request/response details ---'),
      ...responseTimeline,
      logEntry('--- end token request/response details ---'),
    );
    const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);

    const tokenData = await oauthResponseToAccessToken(authentication.accessTokenUrl, response);
    const tokenModel = transformNewAccessTokenToOauthModel(tokenData);
    const token = await services.oAuth2Token.update(old, tokenModel);
    if (tokenData.xError) {
      timeline.push(logEntry(`Token request failed: ${tokenData.xError}`));
      return { token: undefined, timeline };
    }
    timeline.push(logEntry('Token received successfully'));
    return { token, timeline };
  } catch (err) {
    if (authentication.useDefaultBrowser) {
      hideOAuthAuthorizationModal();
    }
    timeline.push(logEntry(`OAuth2 flow error: ${err.message}`));
    throw Object.assign(err, { timeline });
  }
};

async function getExistingAccessTokenAndRefreshIfExpired(
  requestId: string,
  authentication: AuthTypeOAuth2,
  forceRefresh: boolean,
): Promise<{ oAuth2Token: OAuth2Token | undefined; closestAuthId: string; refreshTimeline?: ResponseTimelineEntry[] }> {
  let closestAuthId = requestId;
  const refreshTimeline: ResponseTimelineEntry[] = [];

  try {
    if (!models.mcpRequest.isMcpRequestId(requestId)) {
      const activeRequest = await services.request.getById(requestId);
      const requestGroups = (
        await db.withAncestors<Request | RequestGroup>(activeRequest, [models.requestGroup.type])
      ).filter(isRequestGroup) as RequestGroup[];
      // requestGroups is of order leaf to root
      const closestFolderAuth = requestGroups.find(
        ({ authentication }) => getAuthObjectOrNull(authentication) && isAuthEnabled(authentication),
      );
      const isRequestAuthEnabled =
        getAuthObjectOrNull(activeRequest?.authentication) && isAuthEnabled(activeRequest?.authentication);
      closestAuthId = isRequestAuthEnabled ? requestId : closestFolderAuth?._id || requestId;

      if (isRequestAuthEnabled) {
        refreshTimeline.push(logEntry('Using OAuth2 auth from request'));
      } else if (closestFolderAuth) {
        refreshTimeline.push(logEntry(`Using OAuth2 auth inherited from folder "${closestFolderAuth.name}"`));
      }
    }

    const token = await services.oAuth2Token.getByParentId(closestAuthId);
    if (!token) {
      refreshTimeline.push(logEntry('No existing token found, will fetch new token'));
      return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
    }
    if (!token.accessToken) {
      refreshTimeline.push(logEntry('Existing token has empty access token, will fetch new token'));
      return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
    }
    const expiresAt = token.expiresAt || Infinity;
    const isExpired = Date.now() > expiresAt;
    if (!isExpired && !forceRefresh) {
      refreshTimeline.push(
        logEntry(
          `Existing token is valid (expires: ${token.expiresAt ? new Date(token.expiresAt).toISOString() : 'never'})`,
        ),
      );
      return { oAuth2Token: token, closestAuthId, refreshTimeline };
    }

    if (isExpired) {
      refreshTimeline.push(logEntry(`Token expired at ${new Date(expiresAt).toISOString()}`));
    }
    if (forceRefresh) {
      refreshTimeline.push(logEntry('Force refresh requested'));
    }

    if (!token.refreshToken) {
      refreshTimeline.push(logEntry('No refresh token available, will fetch new token'));
      return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
    }

    refreshTimeline.push(logEntry(`Refreshing token via ${authentication.accessTokenUrl}`));

    let params = [
      { name: 'grant_type', value: 'refresh_token' },
      { name: 'refresh_token', value: token.refreshToken },
      ...insertAuthKeyIf('scope', authentication.scope),
    ];
    const headers = [];
    if (authentication.credentialsInBody) {
      params = [
        ...params,
        ...insertAuthKeyIf('client_id', authentication.clientId),
        ...insertAuthKeyIf('client_secret', authentication.clientSecret),
      ];
    } else {
      headers.push(getBasicAuthHeader(authentication.clientId, authentication.clientSecret));
    }
    const response = await sendAccessTokenRequest(requestId, authentication, params, headers);
    const responseTimeline = await services.helpers.getResponseTimeline(response, true);
    refreshTimeline.push(
      logEntry('--- refresh token request/response details ---'),
      ...responseTimeline,
      logEntry('--- end refresh token request/response details ---'),
    );

    const statusCode = response.statusCode || 0;
    const bodyBuffer = await services.helpers.getResponseBodyBuffer(response);

    if (statusCode === 401) {
      refreshTimeline.push(logEntry('Refresh token rejected (401 Unauthorized)'));
      const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
      services.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({ access_token: null }));
      return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
    }
    const isSuccessful = statusCode >= 200 && statusCode < 300;
    const hasBodyAndIsError = bodyBuffer && statusCode === 400;
    if (!isSuccessful) {
      if (hasBodyAndIsError) {
        const body = tryToParse(bodyBuffer.toString());
        if (body?.error === 'invalid_grant') {
          console.log(`[oauth2] Refresh token rejected due to invalid_grant error: ${body.error_description}`);
          refreshTimeline.push(
            logEntry(`Refresh token rejected: invalid_grant - ${body.error_description || 'no description'}`),
          );
          const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
          await services.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({ access_token: null }));
          return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
        }
      }

      refreshTimeline.push(logEntry(`Failed to refresh token: status=${statusCode}`));
      return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
    }
    if (!bodyBuffer) {
      refreshTimeline.push(logEntry(`No body returned from ${authentication.accessTokenUrl}`));
      return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
    }
    const data = tryToParse(bodyBuffer.toString());
    if (!data) {
      refreshTimeline.push(logEntry('Failed to parse refresh token response body'));
      return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
    }
    refreshTimeline.push(logEntry('Token refreshed successfully'));
    const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
    const oAuth2Token = await services.oAuth2Token.update(
      old,
      transformNewAccessTokenToOauthModel({
        ...data,
        refresh_token: data.refresh_token || token.refreshToken,
      }),
    );
    return { oAuth2Token, closestAuthId, refreshTimeline };
  } catch (err) {
    refreshTimeline.push(logEntry(`Error during token refresh: ${err.message}`));
    return { oAuth2Token: undefined, closestAuthId, refreshTimeline };
  }
}

export const oauthResponseToAccessToken = async (accessTokenUrl: string, response: Response) => {
  const bodyBuffer = await services.helpers.getResponseBodyBuffer(response);
  if (!bodyBuffer) {
    return {
      xResponseId: response._id,
      xError: `No body returned from ${accessTokenUrl}`,
    };
  }
  if (response.statusCode < 200 || response.statusCode >= 300) {
    return {
      xResponseId: response._id,
      xError: `Failed to fetch token url=${accessTokenUrl} status=${response.statusCode}`,
    };
  }
  const body = bodyBuffer.toString('utf8');
  const data = tryToParse(body);
  if (!data) {
    return {
      xResponseId: response._id,
      xError: `Failed to parse response body from ${accessTokenUrl}`,
    };
  }
  if (!data.access_token && !data.id_token) {
    return {
      ...data,
      xResponseId: response._id,
      xError: `No access_token or id_token in response from ${accessTokenUrl}`,
    };
  }
  return {
    ...data,
    xResponseId: response._id,
  };
};

const transformNewAccessTokenToOauthModel = (
  accessToken: Partial<Record<AuthKeys, string | null>>,
): Partial<OAuth2Token> => {
  const expiry = accessToken.expires_in ? +accessToken.expires_in : 0;
  return {
    expiresAt: accessToken.expires_in ? Date.now() + expiry * 1000 : null,
    refreshToken: accessToken.refresh_token || undefined,
    accessToken: accessToken.access_token || undefined,
    identityToken: accessToken.id_token || undefined,
    error: accessToken.error || undefined,
    errorDescription: accessToken.error_description || undefined,
    errorUri: accessToken.error_uri || undefined,
    xResponseId: accessToken.xResponseId || null,
    xError: accessToken.xError || null,
  };
};

const sendAccessTokenRequest = async (
  requestOrGroupId: string,
  authentication: AuthTypeOAuth2,
  params: RequestParameter[],
  headers: RequestHeader[],
) => {
  invariant(authentication.accessTokenUrl, 'Missing access token URL');
  console.log(`[network] Sending with settings req=${requestOrGroupId}`);
  const initializedData = isRequestGroupId(requestOrGroupId)
    ? await fetchRequestGroupData(requestOrGroupId)
    : models.mcpRequest.isMcpRequestId(requestOrGroupId)
      ? await fetchMcpRequestData(requestOrGroupId)
      : await fetchRequestData(requestOrGroupId);

  const { environment, settings, clientCertificates, caCert, activeEnvironmentId, timelinePath, responseId } =
    initializedData;

  const defaultHeaders: RequestHeader[] = [
    { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
    { name: 'Accept', value: 'application/x-www-form-urlencoded, application/json' },
  ];

  const newRequest: Request = {
    ...models.request.init(),
    authentication: {
      type: 'none',
      disabled: false,
    },
    headers: [...defaultHeaders, ...headers],
    url: setDefaultProtocol(authentication.accessTokenUrl),
    method: 'POST',
    body: {
      mimeType: 'application/x-www-form-urlencoded',
      params,
    },
    _id: requestOrGroupId + '.other',
    parentId: requestOrGroupId,
    type: models.request.type,
    modified: Date.now(),
    created: Date.now(),
  };

  const renderResult = await tryToInterpolateRequest({ request: newRequest, environment: environment._id });
  const renderedRequest = await tryToTransformRequestWithPlugins(renderResult);

  const response = await sendCurlAndWriteTimeline(
    renderResult.request,
    clientCertificates,
    caCert,
    { ...settings, validateSSL: settings.validateAuthSSL },
    timelinePath,
    responseId,
  );
  const responsePatch = await responseTransform(response, activeEnvironmentId, renderedRequest, renderResult.context);

  return await services.response.create(responsePatch);
};

export const encodePKCE = (buffer: Buffer) => {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const tryToParse = (body: string): Record<string, any> | null => {
  try {
    return JSON.parse(body);
  } catch {}

  try {
    return querystring.parse(body);
  } catch {}
  return null;
};

const insertAuthKeyIf = (name: AuthKeys, value?: string) => (value ? [{ name, value }] : []);
