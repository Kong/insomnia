import crypto from 'node:crypto';
import querystring from 'node:querystring';

import { v4 as uuidv4 } from 'uuid';

import type {
  AuthTypeOAuth2,
  OAuth2ResponseType,
  OAuth2Token,
  Request,
  RequestGroup,
  RequestHeader,
  RequestParameter,
  Response,
} from '~/insomnia-data';
import { database as db, models, services } from '~/insomnia-data';
import { getBodyBuffer } from '~/models/helpers/response-operations';
import { encryptOAuthUrl } from '~/network/o-auth-2/utils';

import { version } from '../../../package.json';
import { getOauthRedirectUrl, OAUTH_WINDOW_SESSION_ID_KEY } from '../../common/constants';
import { escapeRegex } from '../../common/misc';
import uiEventBus, { OAUTH2_AUTHORIZATION_STATUS_CHANGE } from '../../ui/event-bus';
import { invariant } from '../../utils/invariant';
import { setDefaultProtocol } from '../../utils/url/protocol';
import { getAuthObjectOrNull, isAuthEnabled } from '../authentication';
import { getBasicAuthHeader } from '../basic-auth/get-header';
import {
  fetchMcpRequestData,
  fetchRequestData,
  fetchRequestGroupData,
  responseTransform,
  sendCurlAndWriteTimeline,
  tryToInterpolateRequest,
  tryToTransformRequestWithPlugins,
} from '../network';
import { type AuthKeys, GRANT_TYPE_AUTHORIZATION_CODE, PKCE_CHALLENGE_S256 } from './constants';

const { isRequestGroup, isRequestGroupId } = models.requestGroup;

async function getOAuthWindowHandleSession(): Promise<string> {
  const token = await window.main.electronStorage.getItem(OAUTH_WINDOW_SESSION_ID_KEY);
  if (token) {
    return token;
  }
  const authWindowSessionId = `persist:oauth2_${uuidv4()}`;
  await window.main.electronStorage.setItem(OAUTH_WINDOW_SESSION_ID_KEY, authWindowSessionId);
  return authWindowSessionId;
}

// NOTE
// 1. return valid access token from insomnia db
// 2. send refresh token in order to save and return valid access token
// 3. run a given grant type and save and return valid access token
export const getOAuth2Token = async (
  requestId: string,
  authentication: AuthTypeOAuth2,
  forceRefresh = false,
): Promise<OAuth2Token | undefined> => {
  try {
    // If it's MCP Auth Flow, should leave it to be handled by the MCP auth provider
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
      const redirectedTo = await window.main.authorizeUserInWindow({
        url: implicitUrl.toString(),
        urlSuccessRegex: /(access_token=|id_token=)/,
        urlFailureRegex: /(error=)/,
        sessionId: await getOAuthWindowHandleSession(),
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

      // default to S256 if usePkce is true and pkceMethod is not defined
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

        uiEventBus.emit(OAUTH2_AUTHORIZATION_STATUS_CHANGE, {
          status: 'getting_code',
          authCodeUrlStr: relayUrl,
        });
        // If the user has selected to use the default browser, we will open the
        // authorization URL in the default browser and wait for the user to
        // authorize the application.
        const result = await window.main.authorizeUserInDefaultBrowser({
          url: relayUrl,
        });

        redirectedTo = decryptOAuthResult(result);
      } else {
        redirectedTo = await window.main.authorizeUserInWindow({
          url: authCodeUrl.toString(),
          urlSuccessRegex: authentication.redirectUrl
            ? new RegExp(`${escapeRegex(authentication.redirectUrl)}.*([?&]code=)`, 'i')
            : /([?&]code=)/i,
          urlFailureRegex: authentication.redirectUrl
            ? new RegExp(`${escapeRegex(authentication.redirectUrl)}.*([?&]error=)`, 'i')
            : /([?&]error=)/i,
          sessionId: await getOAuthWindowHandleSession(),
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

    if (authentication.useDefaultBrowser) {
      uiEventBus.emit(OAUTH2_AUTHORIZATION_STATUS_CHANGE, {
        status: 'getting_token',
      });
    }

    const response = await sendAccessTokenRequest(requestId, authentication, params, headers);
    const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);

    if (authentication.useDefaultBrowser) {
      uiEventBus.emit(OAUTH2_AUTHORIZATION_STATUS_CHANGE, {
        status: 'none',
      });
    }

    return services.oAuth2Token.update(
      old,
      transformNewAccessTokenToOauthModel(await oauthResponseToAccessToken(authentication.accessTokenUrl, response)),
    );
  } catch (err) {
    if (authentication.useDefaultBrowser) {
      uiEventBus.emit(OAUTH2_AUTHORIZATION_STATUS_CHANGE, {
        status: 'none',
      });
    }
    throw err;
  }
};
// 1. get token from db and return if valid
// 2. if expired, and no refresh token return null
// 3. run refresh token query and return new token or null if it fails

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
    const closestFolderAuth = [...requestGroups]
      .reverse()
      .find(({ authentication }) => getAuthObjectOrNull(authentication) && isAuthEnabled(authentication));
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

  // token is expired

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
  const bodyBuffer = await getBodyBuffer(response);

  if (statusCode === 401) {
    // If the refresh token was rejected due an unauthorized request, we will
    // return a null access_token to trigger an authentication request to fetch
    // brand new refresh and access tokens.
    const old = await services.oAuth2Token.getOrCreateByParentId(closestAuthId);
    services.oAuth2Token.update(old, transformNewAccessTokenToOauthModel({ access_token: null }));
    return { oAuth2Token: undefined, closestAuthId };
  }
  const isSuccessful = statusCode >= 200 && statusCode < 300;
  const hasBodyAndIsError = bodyBuffer && statusCode === 400;
  if (!isSuccessful) {
    if (hasBodyAndIsError) {
      const body = tryToParse(bodyBuffer.toString());
      // If the refresh token was rejected due an oauth2 invalid_grant error, we will
      // return a null access_token to trigger an authentication request to fetch
      // brand new refresh and access tokens.
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
  const bodyBuffer = await getBodyBuffer(response);
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
    // Calculate expiry date
    expiresAt: accessToken.expires_in ? Date.now() + expiry * 1000 : null,
    refreshToken: accessToken.refresh_token || undefined,
    accessToken: accessToken.access_token || undefined,
    identityToken: accessToken.id_token || undefined,
    error: accessToken.error || undefined,
    errorDescription: accessToken.error_description || undefined,
    errorUri: accessToken.error_uri || undefined,
    // Special Case for response timeline viewing
    xResponseId: accessToken.xResponseId || null,
    // Special Case for empty body or http error code custom messages
    xError: accessToken.xError || null,
  };
};

// This can be sent from a folder
const sendAccessTokenRequest = async (
  requestOrGroupId: string,
  authentication: AuthTypeOAuth2,
  params: RequestParameter[],
  headers: RequestHeader[],
) => {
  invariant(authentication.accessTokenUrl, 'Missing access token URL');
  console.log(`[network] Sending with settings req=${requestOrGroupId}`);
  // @TODO unpack oauth into regular timeline and remove oauth timeline dialog
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
    // Do not inherit authentication from parent request or group since this is a special request
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
  return (
    buffer
      .toString('base64')
      // The characters + / = are reserved for PKCE as per the RFC,
      // so we replace them with unreserved characters
      // Docs: https://tools.ietf.org/html/rfc7636#section-4.2
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  );
};
const tryToParse = (body: string): Record<string, any> | null => {
  try {
    return JSON.parse(body);
  } catch {}

  try {
    // NOTE: parse does not return a JS Object, so
    //   we cannot use hasOwnProperty on it
    return querystring.parse(body);
  } catch {}
  return null;
};

const insertAuthKeyIf = (name: AuthKeys, value?: string) => (value ? [{ name, value }] : []);
