import { getEncryptionKeys, getUserProfile, logout as logoutAPI } from 'insomnia-api';
import type { GitRepository, Project, WorkspaceMeta } from 'insomnia-data';
import type { AESMessage } from 'insomnia-data';
import { models, services } from 'insomnia-data';

import { AI_PLUGIN_NAME, LLM_BACKENDS } from '../common/constants';
import { database } from '../common/database';
import { decryptAES } from '../utils/crypt-adapter';

export interface SessionData {
  accountId: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  symmetricKey: JsonWebKey;
  publicKey: JsonWebKey;
  encPrivateKey: AESMessage;
}

/** Creates a session from a sessionId and derived symmetric key. */
export async function absorbKey(sessionId: string, key: string) {
  // Get and store some extra info (salts and keys)
  const sessionIdResolved = sessionId || (await getCurrentSessionId());
  const [profile, keys] = await Promise.all([
    getUserProfile({ sessionId: sessionIdResolved }),
    getEncryptionKeys({ sessionId: sessionIdResolved }),
  ]);
  const { public_key: publicKey, enc_private_key: encPrivateKey, enc_symmetric_key: encSymmetricKey } = keys;
  const { email, id: accountId, first_name: firstName, last_name: lastName } = profile;
  const symmetricKeyStr = await decryptAES(key, JSON.parse(encSymmetricKey));

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

  if (typeof window !== 'undefined' && window.main?.loginStateChange) {
    window.main.loginStateChange(true);
  }
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

  const privateKeyStr = await decryptAES(symmetricKey, encPrivateKey);
  return JSON.parse(privateKeyStr) as JsonWebKey;
}

export async function getCurrentSessionId() {
  const { id } = await services.userSession.get();
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
      await logoutAPI({ sessionId });
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
  if (typeof window !== 'undefined' && window.main?.loginStateChange) {
    window.main.loginStateChange(false);
  }
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
  encPrivateKey: AESMessage,
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

  await services.userSession.update(sessionData);

  return sessionData;
}

/** Update the session data with vault salt and vault key */
export async function setVaultSessionData(vaultSalt: string, vaultKey: string) {
  await services.userSession.update({ vaultSalt, vaultKey });
}

// ~~~~~~~~~~~~~~~~ //
// Helper Functions //
// ~~~~~~~~~~~~~~~~ //

export async function getUserSession(): Promise<SessionData> {
  const userData = await services.userSession.get();

  return userData;
}

async function _unsetSessionData() {
  await services.userSession.remove();
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
  const removals: Promise<unknown>[] = [services.gitCredentials.removeAll()];

  const cloudCredentials = await services.cloudCredential.all();
  for (const cred of cloudCredentials) {
    if ('credentials' in cred) {
      removals.push(services.cloudCredential.update(cred, { credentials: undefined }));
    }
  }

  for (const backend of LLM_BACKENDS) {
    const apiKey = await services.pluginData.getByKey(AI_PLUGIN_NAME, `${backend}.apiKey`);
    if (apiKey) {
      removals.push(services.pluginData.removeByKey(AI_PLUGIN_NAME, `${backend}.apiKey`));
      if (backend === (await window.main.llm.getActiveBackend())) {
        removals.push(window.main.llm.clearActiveBackend());
      }
    }
  }

  const customGitRepos = await services.gitRepository.all();
  for (const repo of customGitRepos) {
    if (!repo.credentialsId) continue; // unauthenticated git repositories need not be removed
    removals.push(_removeGitRepository(repo));
  }

  const proxySettings = await services.settings.get();
  if (proxySettings.httpProxy?.includes('@')) {
    removals.push(services.settings.update(proxySettings, { httpProxy: '' }));
  }
  if (proxySettings.httpsProxy?.includes('@')) {
    removals.push(services.settings.update(proxySettings, { httpsProxy: '' }));
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
  const queryIds = models.project.getQueryableGitRepositoryIds(repo._id);
  const projects = await database.find<Project>(models.project.type, { gitRepositoryId: { $in: queryIds } });
  for (const p of projects) {
    await services.project.update(p, { gitRepositoryId: models.project.EMPTY_GIT_PROJECT_ID });
  }

  const workspaceMetas = await database.find<WorkspaceMeta>(models.workspaceMeta.type, { gitRepositoryId: repo._id });
  for (const wsMeta of workspaceMetas) {
    await services.workspaceMeta.update(wsMeta, { gitRepositoryId: null });
  }
  await services.gitRepository.remove(repo);
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

    const currentUserSession = await services.userSession.get();

    if (currentUserSession.id) {
      console.warn('Session already exists, skipping migration');
    } else {
      await services.userSession.update(sessionData);
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
