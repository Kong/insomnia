import crypto from 'node:crypto';

import type { DevPortalOAuthClient, DevPortalOAuthToken, DevPortalProject, OAuth2ResponseType } from 'insomnia-data';
import { models, services } from 'insomnia-data';

import { getOauthRedirectUrl, getProductName } from '~/common/constants';
import { insomniaFetch } from '~/common/insomnia-fetch';
import { invariant } from '~/common/utils/invariant';
import { authorizeUserInDefaultBrowser } from '~/main/authorize-user-in-default-browser';
import { decryptString, encryptString } from '~/main/ipc/secret-storage';
import {
  encodePKCE,
  encryptOAuthUrl,
  GRANT_TYPE_AUTHORIZATION_CODE,
  hideOAuthAuthorizationModal,
  showOAuthAuthorizationModal,
} from '~/main/network/o-auth-2/get-token';

interface OIDCConfiguration {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
}

interface DynamicClientRegistrationPayload {
  client_name: string;
  application_type: 'machine';
  grant_types: ('authorization_code' | 'implicit' | 'refresh_token' | 'client_credentials')[];
  token_endpoint_auth_method: 'none' | 'client_secret_post';
  response_types: OAuth2ResponseType[];
  redirect_uris: string[];
}

interface RegisteredOAuthClientResponse extends DynamicClientRegistrationPayload {
  client_id: string;
  client_secret: string;
  client_secret_expires_at: number;
}

interface ExchangeTokenResponse {
  access_token: string;
  id_token: string;
  refresh_token?: string;
  token_type: string;
  scope?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  error_uri?: string;
}

const SCOPE_PORTAL_READ = 'portal:read';

const fetchOIDCConfiguration = async (): Promise<OIDCConfiguration> => {
  // FIX ME this is hard-coded here, will get the OIDC configuration from the dev portal project in the future
  const origin = 'https://149ozj5hnlxkazz8.us.identity.konghq.tech';
  const oidcConfigPath = '/auth/.well-known/openid-configuration';
  try {
    const config = await insomniaFetch<OIDCConfiguration>({
      method: 'GET',
      origin,
      path: oidcConfigPath,
    });
    invariant(config.authorization_endpoint, 'OIDC configuration is missing authorization_endpoint');
    invariant(config.token_endpoint, 'OIDC configuration is missing token_endpoint');
    invariant(config.registration_endpoint, 'OIDC configuration is missing registration_endpoint');
    invariant(
      config.scopes_supported.includes(SCOPE_PORTAL_READ),
      `OIDC configuration does not support required scope: ${SCOPE_PORTAL_READ}`,
    );
    return config;
  } catch (error) {
    throw new Error(`Failed to fetch OIDC configuration from ${origin}${oidcConfigPath}: ${error}`);
  }
};

const registerOAuthClient = async (
  registrationEndpoint: string,
): Promise<
  Pick<RegisteredOAuthClientResponse, 'client_id' | 'client_name' | 'client_secret' | 'client_secret_expires_at'>
> => {
  try {
    const payload: DynamicClientRegistrationPayload = {
      client_name: getProductName(),
      application_type: 'machine',
      grant_types: [GRANT_TYPE_AUTHORIZATION_CODE],
      token_endpoint_auth_method: 'client_secret_post',
      response_types: ['code'],
      redirect_uris: [getOauthRedirectUrl()],
    };
    const response = await insomniaFetch<RegisteredOAuthClientResponse>({
      method: 'POST',
      origin: registrationEndpoint,
      path: '',
      data: payload,
    });
    invariant(response.client_id, 'Dynamic client registration response is missing client_id');
    invariant(response.client_secret, 'Dynamic client registration response is missing client_secret');
    return {
      client_id: response.client_id,
      client_name: response.client_name,
      client_secret: response.client_secret,
      client_secret_expires_at: response.client_secret_expires_at,
    };
  } catch (error) {
    throw new Error(`Failed to dynamic register OAuth client at ${registrationEndpoint}: ${error}`);
  }
};

const getOrRegisterOAuthClient = async (
  project: DevPortalProject,
  oidc: OIDCConfiguration,
): Promise<{ client: DevPortalOAuthClient; clientSecret: string }> => {
  if (project.devPortalOAuthClient) {
    const clientSecret = decryptString(project.devPortalOAuthClient.clientSecretEncrypted);
    return { client: project.devPortalOAuthClient, clientSecret };
  }
  invariant(oidc.registration_endpoint, 'OIDC configuration is missing registration_endpoint');

  const { client_id, client_name, client_secret, client_secret_expires_at } = await registerOAuthClient(
    oidc.registration_endpoint,
  );
  const client: DevPortalOAuthClient = {
    clientId: client_id,
    clientName: client_name,
    clientSecretEncrypted: encryptString(client_secret),
    registrationEndpoint: oidc.registration_endpoint,
    authorizationEndpoint: oidc.authorization_endpoint,
    tokenEndpoint: oidc.token_endpoint,
    clientSecretExpiresAt: client_secret_expires_at,
    registeredAt: Date.now(),
  };
  await services.project.update(project, { devPortalOAuthClient: client });
  return { client, clientSecret: client_secret };
};

const exchangeCodeForToken = async ({
  tokenEndpoint,
  code,
  codeVerifier,
  clientId,
  clientSecret,
  redirectUri,
}: {
  tokenEndpoint: string;
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) => {
  const payload = new URLSearchParams({
    grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
  });

  try {
    const response = await insomniaFetch<ExchangeTokenResponse>({
      method: 'POST',
      origin: tokenEndpoint,
      path: '',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      data: payload,
    });
    return response;
  } catch (error) {
    throw new Error(`Failed to exchange authorization code for token at ${tokenEndpoint}: ${error}`);
  }
};

export const oauthLoginToDevPortal = async ({ projectId }: { projectId: string }) => {
  try {
    const project = await services.project.getById(projectId);
    invariant(project, `Project not found: ${projectId}`);
    invariant(models.project.isDevPortalProject(project), `Project ${projectId} is not a dev portal project`);

    const oidcConfig = await fetchOIDCConfiguration();
    const { client, clientSecret } = await getOrRegisterOAuthClient(project, oidcConfig);

    const codeVerifier = encodePKCE(crypto.randomBytes(32));
    const codeChallenge = encodePKCE(crypto.createHash('sha256').update(codeVerifier).digest());
    const redirectUri = getOauthRedirectUrl();

    const responseType: OAuth2ResponseType = 'code';
    const authCodeUrl = new URL(client.authorizationEndpoint);
    authCodeUrl.searchParams.append('response_type', responseType);
    authCodeUrl.searchParams.append('client_id', client.clientId);
    authCodeUrl.searchParams.append('redirect_uri', redirectUri);
    authCodeUrl.searchParams.append('scope', [SCOPE_PORTAL_READ].join(' '));
    authCodeUrl.searchParams.append('code_challenge', codeChallenge);
    authCodeUrl.searchParams.append('code_challenge_method', 'S256');

    const { relayUrl, decryptOAuthResult } = encryptOAuthUrl(authCodeUrl.toString());

    showOAuthAuthorizationModal(relayUrl);
    let redirectedTo: string;
    try {
      const result = await authorizeUserInDefaultBrowser({ url: relayUrl });
      redirectedTo = decryptOAuthResult(result);
    } finally {
      hideOAuthAuthorizationModal();
    }

    const redirectParams = Object.fromEntries(new URL(redirectedTo).searchParams);
    if (redirectParams.error) {
      throw new Error(
        `Dev portal OAuth error: ${redirectParams.error} ${redirectParams.error_description || ''}`.trim(),
      );
    }
    invariant(redirectParams.code, 'No authorization code returned from dev portal IdP');

    const tokenResponse = await exchangeCodeForToken({
      tokenEndpoint: client.tokenEndpoint,
      code: redirectParams.code,
      codeVerifier,
      clientId: client.clientId,
      clientSecret,
      redirectUri,
    });
    if (tokenResponse.error) {
      throw new Error(
        `Dev portal OAuth token exchange error: ${tokenResponse.error} ${tokenResponse.error_description || ''}`.trim(),
      );
    }
    invariant(tokenResponse.access_token, 'Token endpoint response is missing access_token');

    const token: DevPortalOAuthToken = {
      accessTokenEncrypted: encryptString(tokenResponse.access_token),
      refreshTokenEncrypted: tokenResponse.refresh_token ? encryptString(tokenResponse.refresh_token) : undefined,
      idTokenEncrypted: tokenResponse.id_token ? encryptString(tokenResponse.id_token) : undefined,
      tokenType: tokenResponse.token_type,
      expiresAt: tokenResponse.expires_in ? Date.now() + tokenResponse.expires_in * 1000 : 0,
      obtainedAt: Date.now(),
      error: tokenResponse.error,
      errorDescription: tokenResponse.error_description,
    };

    const latestProject = await services.project.getById(projectId);
    invariant(latestProject, `Project not found: ${projectId}`);
    await services.project.update(latestProject, { devPortalOAuthToken: token });
    return tokenResponse.access_token;
  } catch (err) {
    console.error('[dev-portal-oauth] Failed to log in to dev portal', err);
    throw err;
  }
};
