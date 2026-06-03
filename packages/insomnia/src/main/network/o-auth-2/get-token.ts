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
} from 'insomnia-data';
import { database as db, models, services } from 'insomnia-data';
import { v4 as uuidv4 } from 'uuid';

import { authorizeUserInDefaultBrowser } from '~/main/authorize-user-in-default-browser';
import { authorizeUserInWindow } from '~/main/authorize-user-in-window';
import { getElectronStorage as getSharedElectronStorage } from '~/main/electron-storage';

import { version } from '../../../../package.json';
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
import { invariant } from '../../../utils/invariant';
import { setDefaultProtocol } from '../../../utils/url/protocol';

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

export const getOAuth2Token = async (
  requestId: string,
  authentication: AuthTypeOAuth2,
  forceRefresh = false,
): Promise<OAuth2Token | undefined> => {
  try {
    if (authentication.grantType === 'mcp_auth_flow') {
      return undefined;
    }
    const { oAuth2Token, closestAuthId } = await getExistingAccessTokenAndRefreshIfExpired(
      requestId,
      authentication,
      forceRefresh,
    );
    if (oAuth2Token) {
      return oAuth2Token;
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
      const redirectedTo = await authorizeUserInWindow({
        url: implicitUrl.toString(),
        urlSuccessRegex: /(access_token=|id_token=)/,
        urlFailureRegex: /(error=)/,
        sessionId: getOAuthSession(),
      });
      console.log('[oauth2] Detected redirect ' + redirectedTo);

      const responseUrl = new URL(redirectedTo);
      if (responseUrl.searchParams.has('error')) {
        const params = Object.fromEntries(responseUrl.searchParams);
        const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
        return services.oAuth2Token.update(old, transformNewAccessTokenToOauthModel(params));
      }
      const hash = responseUrl.hash.slice(1);
      invariant(hash, 'No hash found in response URL from OAuth2 provider');
      const data = Object.fromEntries(new URLSearchParams(hash));
      const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
      return services.oAuth2Token.update(
        old,
        transformNewAccessTokenToOauthModel({
          ...data,
          access_token: data.access_token || data.id_token,
        }),
      );
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
        const authCodeUrlStr = authCodeUrl.toString();
        const { relayUrl, decryptOAuthResult } = encryptOAuthUrl(authCodeUrlStr);

        showOAuthAuthorizationModal(relayUrl);
        const result = await authorizeUserInDefaultBrowser({
          url: relayUrl,
        });
        hideOAuthAuthorizationModal();

        redirectedTo = decryptOAuthResult(result);
      } else {
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
      }

      console.log('[oauth2] Detected redirect ' + redirectedTo);
      const redirectParams = Object.fromEntries(new URL(redirectedTo).searchParams);
      if (redirectParams.error) {
        const code = redirectParams.error;
        const msg = redirectParams.error_description;
        const uri = redirectParams.error_uri;
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

    const response = await sendAccessTokenRequest(requestId, authentication, params, headers);
    const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);

    return services.oAuth2Token.update(
      old,
      transformNewAccessTokenToOauthModel(await oauthResponseToAccessToken(authentication.accessTokenUrl, response)),
    );
  } catch (err) {
    if (authentication.useDefaultBrowser) {
      hideOAuthAuthorizationModal();
    }
    throw err;
  }
};

async function getExistingAccessTokenAndRefreshIfExpired(
  requestId: string,
  authentication: AuthTypeOAuth2,
  forceRefresh: boolean,
): Promise<{ oAuth2Token: OAuth2Token | undefined; closestAuthId: string }> {
  let closestAuthId = requestId;

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
  }

  const token = await services.oAuth2Token.getByParentId(closestAuthId);
  if (!token) {
    return { oAuth2Token: undefined, closestAuthId };
  }
  const expiresAt = token.expiresAt || Infinity;
  const isExpired = Date.now() > expiresAt;
  if (!isExpired && !forceRefresh) {
    return { oAuth2Token: token, closestAuthId };
  }

  if (!token.refreshToken) {
    return { oAuth2Token: undefined, closestAuthId };
  }

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

  const statusCode = response.statusCode || 0;
  const bodyBuffer = await services.helpers.getResponseBodyBuffer(response);

  if (statusCode === 401) {
    const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
    services.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({ access_token: null }));
    return { oAuth2Token: undefined, closestAuthId };
  }
  const isSuccessful = statusCode >= 200 && statusCode < 300;
  const hasBodyAndIsError = bodyBuffer && statusCode === 400;
  if (!isSuccessful) {
    if (hasBodyAndIsError) {
      const body = tryToParse(bodyBuffer.toString());
      if (body?.error === 'invalid_grant') {
        console.log(`[oauth2] Refresh token rejected due to invalid_grant error: ${body.error_description}`);
        const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
        const token = await services.oAuth2Token.update(
          old,
          transformNewAccessTokenToOauthModel({ access_token: null }),
        );
        return { oAuth2Token: token, closestAuthId };
      }
    }

    throw new Error(`[oauth2] Failed to refresh token url=${authentication.accessTokenUrl} status=${statusCode}`);
  }
  invariant(bodyBuffer, `[oauth2] No body returned from ${authentication.accessTokenUrl}`);
  const data = tryToParse(bodyBuffer.toString());
  if (!data) {
    return { oAuth2Token: undefined, closestAuthId };
  }
  const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
  const oAuth2Token = await services.oAuth2Token.update(
    old,
    transformNewAccessTokenToOauthModel({
      ...data,
      refresh_token: data.refresh_token || token.refreshToken,
    }),
  );
  return { oAuth2Token, closestAuthId };
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

  const defaultUserAgentHeader: RequestHeader = { name: 'User-Agent', value: `insomnia/${version}` };
  const defaultHeaders: RequestHeader[] = [
    { name: 'Content-Type', value: 'application/x-www-form-urlencoded' },
    { name: 'Accept', value: 'application/x-www-form-urlencoded, application/json' },
  ];

  if (!settings.disableAppVersionUserAgent) {
    defaultHeaders.push(defaultUserAgentHeader);
  }
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
