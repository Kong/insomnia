import { AI_PLUGIN_NAME, LLM_BACKENDS } from '../common/constants';
import { database } from '../common/database';
import {
  cloudCredential,
  gitCredentials,
  gitRepository,
  pluginData,
  project,
  settings,
  userSession,
  workspaceMeta,
} from '../models';
import { type GitRepository, isGitCredentialsOAuth } from '../models/git-repository';
import { EMPTY_GIT_PROJECT_ID, type Project } from '../models/project';
import type { WorkspaceMeta } from '../models/workspace-meta';
import { insomniaFetch } from '../ui/insomniaFetch';
import * as crypt from './crypt';

type LoginCallback = (isLoggedIn: boolean) => void;

export interface WhoamiResponse {
  sessionAge: number;
  sessionExpiry: number;
  accountId: string;
  email: string;
  firstName: string;
  lastName: string;
  created: number;
  publicKey: string;
  encSymmetricKey: string;
  encPrivateKey: string;
  saltEnc: string;
  isPaymentRequired: boolean;
  isTrialing: boolean;
  isVerified: boolean;
  isAdmin: boolean;
  trialEnd: string;
  planName: string;
  planId: string;
  canManageTeams: boolean;
  maxTeamMembers: number;
}

export interface SessionData {
  accountId: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: crypt.AESMessage;
}
export function onLoginLogout(loginCallback: LoginCallback) {
  window.main.on('loggedIn', async () => {
    loginCallback(await isLoggedIn());
  });
}

/** Creates a session from a sessionId and derived symmetric key. */
export async function absorbKey(sessionId: string, key: string) {
  // Get and store some extra info (salts and keys)
  const { publicKey, encPrivateKey, encSymmetricKey, email, accountId, firstName, lastName } = await _whoami(sessionId);
  const symmetricKeyStr = crypt.decryptAES(key, JSON.parse(encSymmetricKey));

  // Store the information for later
  await setSessionData(
    sessionId,
    accountId,
    firstName,
    lastName,
    email,
    JSON.parse(symmetricKeyStr),
    JSON.parse(publicKey),
    JSON.parse(encPrivateKey),
  );

  window.main.loginStateChange();
}

export async function getPublicKey() {
  return (await getUserSession())?.publicKey;
}

export async function getPrivateKey() {
  const sessionData = await getUserSession();

  if (!sessionData) {
    throw new Error("Can't get private key: session is blank.");
  }

  const { symmetricKey, encPrivateKey } = sessionData;

  if (!symmetricKey || !encPrivateKey) {
    throw new Error("Can't get private key: session is missing keys.");
  }

  const privateKeyStr = crypt.decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr) as JsonWebKey;
}

export async function getCurrentSessionId() {
  const { id } = await userSession.getOrCreate();
  return id;
}

export async function getAccountId() {
  return (await getUserSession())?.accountId;
}

/** Check if we (think) we have a session */
export async function isLoggedIn() {
  return Boolean(await getCurrentSessionId());
}

/** Log out and delete session data */
export async function logout(clearCredentials = false) {
  const sessionId = await getCurrentSessionId();
  if (sessionId) {
    try {
      insomniaFetch({
        method: 'POST',
        path: '/auth/logout',
        sessionId,
      });
    } catch (error) {
      // Not a huge deal if this fails, but we don't want it to prevent the
      // user from signing out.
      console.warn('Failed to logout', error);
    }
  }

  await _unsetSessionData();
  if (clearCredentials) {
    await _removeAllCredentials();
  }
  window.main.loginStateChange();
}

/** Set data for the new session and store it encrypted with the sessionId */
export async function setSessionData(
  id: string,
  accountId: string,
  firstName: string,
  lastName: string,
  email: string,
  symmetricKey: JsonWebKey,
  publicKey: JsonWebKey,
  encPrivateKey: crypt.AESMessage,
) {
  const sessionData: SessionData = {
    id,
    accountId,
    symmetricKey,
    publicKey,
    encPrivateKey,
    email,
    firstName,
    lastName,
  };

  const userData = await userSession.getOrCreate();
  await userSession.update(userData, sessionData);

  return sessionData;
}

/** Update the session data with vault salt and vault key */
export async function setVaultSessionData(vaultSalt: string, vaultKey: string) {
  const userData = await userSession.getOrCreate();
  await userSession.update(userData, { vaultSalt, vaultKey });
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

async function _whoami(sessionId: string | null = null): Promise<WhoamiResponse> {
  const response = await insomniaFetch<WhoamiResponse | string>({
    method: 'GET',
    path: '/auth/whoami',
    sessionId: sessionId || (await getCurrentSessionId()),
  });
  if (typeof response === 'string') {
    throw new Error('Unexpected plaintext response: ' + response);
  }
  if (response && !response?.encSymmetricKey) {
    throw new Error('Unexpected response: ' + JSON.stringify(response));
  }
  return response;
}

export async function getUserSession(): Promise<SessionData> {
  const userData = await userSession.getOrCreate();

  return userData;
}

async function _unsetSessionData() {
  await userSession.getOrCreate();
  await userSession.update(await userSession.getOrCreate(), {
    id: '',
    accountId: '',
    email: '',
    firstName: '',
    lastName: '',
    symmetricKey: {} as JsonWebKey,
    publicKey: {} as JsonWebKey,
    encPrivateKey: {} as crypt.AESMessage,
    vaultSalt: '',
    vaultKey: '',
  });
}

/**
 * Removes all sensitive data (credentials, keys, tokens, etc.) from disk.
 *
 * If any cloud credential is authenticated (key/token provided), it is cleared.
 *
 * All Git provider (GitHub, GitLab) credentials are deleted.
 *
 * If any custom git repositories are authenticated, the workspace is disconnected and the git
 * repository is deleted from the database (but it does not remove a checkout from the filesystem).
 *
 * If any proxy is authenticated, it is cleared.
 *
 * If any LLM provider is authenticated, the API key is removed, and deactivated if active.
 */
async function _removeAllCredentials() {
  const removals: Promise<unknown>[] = [gitCredentials.removeAll()];

  const cloudCredentials = await cloudCredential.all();
  for (const cred of cloudCredentials) {
    if ('credentials' in cred) {
      if ('secretAccessKey' in cred.credentials) {
        removals.push(
          cloudCredential.update(cred, {
            // AWS
            credentials: { ...cred.credentials, secretAccessKey: '', sessionToken: '' },
          }),
        );
        continue;
      }
      // hashicorp
      if ('access_token' in cred.credentials) {
        removals.push(cloudCredential.update(cred, { credentials: { ...cred.credentials, access_token: '' } }));
        continue;
      }
      if ('client_secret' in cred.credentials) {
        removals.push(cloudCredential.update(cred, { credentials: { ...cred.credentials, client_secret: '' } }));
        continue;
      }
      if ('secret_id' in cred.credentials) {
        removals.push(
          cloudCredential.update(cred, { credentials: { ...cred.credentials, secret_id: '', role_id: '' } }),
        );
        continue;
      }
      // azure
      if ('accessToken' in cred.credentials) {
        removals.push(cloudCredential.update(cred, { credentials: { ...cred.credentials, accessToken: '' } }));
      }
    }
  }

  for (const backend of LLM_BACKENDS) {
    const apiKey = await pluginData.getByKey(AI_PLUGIN_NAME, `${backend}.apiKey`);
    if (apiKey) {
      removals.push(pluginData.removeByKey(AI_PLUGIN_NAME, `${backend}.apiKey`));
      if (backend === (await window.main.llm.getActiveBackend())) {
        removals.push(window.main.llm.clearActiveBackend());
      }
    }
  }

  const customGitRepos = await gitRepository.all();
  for (const repo of customGitRepos) {
    if (!repo.credentials) continue; // unauthenticated git repositories need not be removed
    if (isGitCredentialsOAuth(repo.credentials)) {
      if (repo.credentials.token) {
        removals.push(_removeGitRepository(repo));
      }
    } else if (repo.credentials.password) {
      removals.push(_removeGitRepository(repo));
    }
  }

  const proxySettings = await settings.get();
  if (proxySettings.httpProxy?.includes('@')) {
    removals.push(settings.update(proxySettings, { httpProxy: '' }));
  }
  if (proxySettings.httpsProxy?.includes('@')) {
    removals.push(settings.update(proxySettings, { httpsProxy: '' }));
  }

  await Promise.all(removals);
}

/*
 * Removes a git repo from the database and unlinks it from associated projects and workspaces.
 *
 * Clearing only the credentials from the git repo would leave the associated workspace in a broken
 * state where the user would need to manually reset the git repo settings, and that is not
 * immediately apparent in the UI.
 *
 * This way, the user can simply re-connect with their settings.
 *
 * Almost identical to resetGitRepoAction in main/git-service.ts, but walks through
 * each model instance individually to clear them all out.
 *
 */
async function _removeGitRepository(repo: GitRepository) {
  const projects = await database.find<Project>(project.type, { gitRepositoryId: repo._id });
  for (const p of projects) {
    await project.update(p, { gitRepositoryId: EMPTY_GIT_PROJECT_ID });
  }

  const workspaceMetas = await database.find<WorkspaceMeta>(workspaceMeta.type, { gitRepositoryId: repo._id });
  for (const wsMeta of workspaceMetas) {
    await workspaceMeta.update(wsMeta, { gitRepositoryId: null });
  }
  await gitRepository.remove(repo);
}

// TODO: v12 remove this function and getLocalStorageDataFromFileOrigin from main
export async function migrateFromLocalStorage() {
  if (!window.localStorage.getItem('file-origin-localStorage-migrated')) {
    console.log('[migration] Migrating localStorage data from file origin');
    try {
      const localStorageData = await window.main.getLocalStorageDataFromFileOrigin();
      if (localStorageData) {
        for (const [key, value] of Object.entries(localStorageData)) {
          if (key && value) {
            localStorage.setItem(key, value);
          }
        }
        localStorage.setItem('file-origin-localStorage-migrated', 'true');
      }
    } catch (error) {
      console.error('[migration] Failed to migrate localStorage data:', error);
    }
  }
  const sessionId = window.localStorage.getItem('currentSessionId');

  if (!sessionId) {
    return;
  }

  const sessionKey = `session__${(sessionId || '').slice(0, 10)}`;
  const session = window.localStorage.getItem(sessionKey);

  if (!session) {
    return;
  }

  try {
    const sessionData = JSON.parse(session) as SessionData;

    const currentUserSession = await userSession.getOrCreate();

    if (currentUserSession.id) {
      console.warn('Session already exists, skipping migration');
    } else {
      await userSession.update(currentUserSession, sessionData);
    }
  } catch (e) {
    console.error('Failed to parse session data', e);
  } finally {
    // Clean up local storage session data
    window.localStorage.removeItem(sessionKey);
    window.localStorage.removeItem('currentSessionId');
  }

  return;
}
