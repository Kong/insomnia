import './rendererListeners';

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import {
  createMemoryRouter,
  matchPath,
  Outlet,
  RouterProvider,
} from 'react-router-dom';

import { migrateFromLocalStorage, type SessionData, setSessionData, setVaultSessionData } from '../account/session';
import {
  ACTIVITY_DEBUG,
  ACTIVITY_SPEC,
  getInsomniaSession,
  getInsomniaVaultKey,
  getInsomniaVaultSalt,
  getProductName,
  getSkipOnboarding,
  isDevelopment,
} from '../common/constants';
import { database } from '../common/database';
import { initializeLogging } from '../common/log';
import * as models from '../models';
import { initNewOAuthSession } from '../network/o-auth-2/get-token';
import { init as initPlugins } from '../plugins';
import { applyColorScheme } from '../plugins/misc';
import { invariant } from '../utils/invariant';
import { getInitialEntry } from '../utils/router';
import { AppLoadingIndicator } from './components/app-loading-indicator';
import Auth from './routes/auth';
import Authorize from './routes/auth.authorize';
import Login from './routes/auth.login';
import { ErrorRoute } from './routes/error';
import Onboarding from './routes/onboarding';
import { Migrate } from './routes/onboarding.migrate';
import Root from './routes/root';
import { initializeSentry } from './sentry';

const Organization = lazy(() => import('./routes/organization'));
const Project = lazy(() => import('./routes/project'));
const Workspace = lazy(() => import('./routes/workspace'));
const UnitTest = lazy(() => import('./routes/unit-test'));
const Debug = lazy(() => import('./routes/debug'));
const Design = lazy(() => import('./routes/design'));
const MockServer = lazy(() => import('./routes/mock-server'));
const Environments = lazy(() => import('./routes/environments'));

initializeSentry();
initializeLogging();
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

try {
  // In order to run playwight tests that simulate a logged in user
  // we need to inject state into localStorage
  const skipOnboarding = getSkipOnboarding();
  if (skipOnboarding) {
    window.localStorage.setItem('hasSeenOnboardingV10', skipOnboarding.toString());
    window.localStorage.setItem('hasUserLoggedInBefore', skipOnboarding.toString());
  }
} catch (e) {
  console.log('[onboarding] Failed to parse session data', e);
}

async function renderApp() {
  await database.initClient();
  await initPlugins();

  await migrateFromLocalStorage();

  // Check if there is a Session provided by an env variable and use this
  const insomniaSession = getInsomniaSession();
  const insomniaVaultKey = getInsomniaVaultKey();
  const insomniaVaultSalt = getInsomniaVaultSalt();
  if (insomniaSession) {
    try {
      const session = JSON.parse(insomniaSession) as SessionData;
      await setSessionData(
        session.id,
        session.accountId,
        session.firstName,
        session.lastName,
        session.email,
        session.symmetricKey,
        session.publicKey,
        session.encPrivateKey
      );
      if (insomniaVaultSalt && insomniaVaultKey) {
        await setVaultSessionData(insomniaVaultSalt, insomniaVaultKey);
      }
    } catch (e) {
      console.log('[init] Failed to parse session data', e);
    }
  }

  const settings = await models.settings.getOrCreate();

  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }

  await applyColorScheme(settings);

  const root = document.getElementById('root');

  invariant(root, 'Could not find root element');

  const initialEntry = await getInitialEntry();

  const router = createMemoryRouter(
    // @TODO - Investigate file based routing to generate these routes:
    [
      {
        path: '/',
        id: 'root',
        element: <Root />,
        loader: async (...args) => (await import('./routes/root')).loader(...args),
        errorElement: <ErrorRoute />,
        children: [
          {
            path: 'onboarding/*',
            element: <Onboarding />,
            errorElement: <ErrorRoute />,
          },
          {
            path: 'onboarding/migrate',
            loader: async (...args) => (await import('./routes/onboarding.migrate')).loader(...args),
            action: async (...args) => (await import('./routes/onboarding.migrate')).action(...args),
            element: <Migrate />,
          },
          {
            path: 'commands',
            loader: async (...args) => (await import('./routes/commands')).loader(...args),
          },
          {
            path: 'git-credentials',
            loader: async (...args) => (await import('./routes/git-actions')).loadGitCredentials(...args),
            children: [
              {
                'path': 'github',
                loader: async (...args) => (await import('./routes/git-actions')).loadGitHubCredentials(...args),
                children: [
                  {
                    path: 'init-sign-in',
                    action: async (...args) => (await import('./routes/git-actions')).initSignInToGitHub(...args),
                  },
                  {
                    path: 'complete-sign-in',
                    action: async (...args) => (await import('./routes/git-actions')).completeSignInToGitHub(...args),
                  },
                  {
                    path: 'sign-out',
                    action: async (...args) => (await import('./routes/git-actions')).signOutOfGitHub(...args),
                  },
                ],
              },
              {
                'path': 'gitlab',
                loader: async (...args) => (await import('./routes/git-actions')).loadGitLabCredentials(...args),
                children: [
                  {
                    path: 'init-sign-in',
                    action: async (...args) => (await import('./routes/git-actions')).initSignInToGitLab(...args),
                  },
                  {
                    path: 'complete-sign-in',
                    action: async (...args) => (await import('./routes/git-actions')).completeSignInToGitLab(...args),
                  },
                  {
                    path: 'sign-out',
                    action: async (...args) => (await import('./routes/git-actions')).signOutOfGitLab(...args),
                  },
                ],
              },
            ],
          },
          {
            path: 'remote-files',
            loader: async (...args) => (await import('./routes/commands')).remoteFilesLoader(...args),
          },
          {
            path: 'import',
            children: [
              {
                path: 'scan',
                action: async (...args) =>
                  (await import('./routes/import')).scanForResourcesAction(
                    ...args,
                  ),
              },
              {
                path: 'resources',
                action: async (...args) =>
                  (await import('./routes/import')).importResourcesAction(
                    ...args,
                  ),
              },
            ],
          },
          {
            path: 'settings/update',
            action: async (...args) =>
              (await import('./routes/actions')).updateSettingsAction(...args),
          },
          {
            path: 'untracked-projects',
            loader: async (...args) => (await import('./routes/untracked-projects')).loader(...args),
          },
          {
            path: 'organization',
            id: '/organization',
            loader: async (...args) => (await import('./routes/organization')).loader(...args),
            element: <Suspense fallback={<AppLoadingIndicator />}><Organization /></Suspense>,
            errorElement: <ErrorRoute defaultMessage='A temporarily unexpected error occurred, please reload to try again' />,
            children: [
              {
                index: true,
                loader: async (...args) => (await import('./routes/organization')).indexLoader(...args),
              },
              {
                path: 'sync',
                action: async (...args) => (await import('./routes/organization')).syncOrganizationsAction(...args),
              },
              {
                path: 'sync-orgs-and-projects',
                action: async (...args) => (await import('./routes/organization')).syncOrgsAndProjectsAction(...args),
              },
              {
                path: ':organizationId',
                id: ':organizationId',
                children: [
                  {
                    index: true,
                    loader: async (...args) =>
                      (await import('./routes/project')).indexLoader(...args),
                  },
                  {
                    path: 'git',
                    children: [
                      {
                        path: 'init-clone',
                        action: async (...args) =>
                          (
                            await import('./routes/git-project-actions')
                          ).initGitCloneAction(...args),
                      },
                      {
                        path: 'clone',
                        action: async (...args) =>
                          (
                            await import('./routes/git-project-actions')
                          ).cloneGitRepoAction(...args),
                      },
                    ],
                  },
                  {
                    path: 'permissions',
                    loader: async (...args) =>
                      (
                        await import('./routes/organization')
                      ).organizationPermissionsLoader(...args),
                    shouldRevalidate: data => data.currentParams.organizationId !== data.nextParams.organizationId,
                  },
                  {
                    path: 'storage-rule',
                    loader: async (...args) =>
                      (
                        await import('./routes/organization')
                      ).organizationStorageLoader(...args),
                  },
                  {
                    path: 'sync-storage-rule',
                    action: async (...args) =>
                      (
                        await import('./routes/organization')
                      ).syncOrganizationStorageRuleAction(...args),
                  },
                  {
                    path: 'sync-projects',
                    action: async (...args) =>
                      (
                        await import('./routes/project')
                      ).syncProjectsAction(...args),
                  },
                  {
                    path: 'ai/access',
                    action: async (...args) =>
                      (
                        await import('./routes/actions')
                      ).accessAIApiAction(...args),
                  },
                  {
                    path: 'collaborators',
                    loader: async (...args) =>
                      (
                        await import('./routes/invite')
                      ).collaboratorsListLoader(...args),
                  },
                  {
                    path: 'collaborators-search',
                    loader: async (...args) =>
                      (
                        await import('./routes/invite')
                      ).collaboratorSearchLoader(...args),
                  },
                  {
                    path: 'invites',
                    children: [
                      {
                        path: ':invitationId',
                        id: ':invitationId',
                        action: async (...args) =>
                          (
                            await import('./routes/invite')
                          ).updateInvitationRoleAction(...args),
                        children: [
                          {
                            path: 'reinvite',
                            action: async (...args) =>
                              (
                                await import('./routes/invite')
                              ).reinviteCollaboratorAction(...args),
                          },
                        ],
                      },
                    ],
                  },
                  {
                    path: 'members',
                    children: [
                      {
                        path: ':userId',
                        id: ':userId',
                        children: [
                          {
                            path: 'roles',
                            action: async (...args) =>
                              (
                                await import('./routes/invite')
                              ).updateMemberRoleAction(...args),
                          },
                        ],
                      },
                    ],
                  },
                  {
                    path: 'project',
                    id: '/project',
                    children: [
                      {
                        index: true,
                        loader: async (...args) =>
                          (await import('./routes/project')).loader(...args),
                        element: (
                          <Suspense fallback={<AppLoadingIndicator />}>
                            <Project />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'new',
                        action: async (...args) =>
                          (
                            await import('./routes/actions')
                          ).createNewProjectAction(...args),
                      },
                      {
                        path: ':projectId',
                        id: '/project/:projectId',
                        loader: async (...args) =>
                          (await import('./routes/project')).projectIdLoader(...args),
                        children: [
                          {
                            index: true,
                            loader: async (...args) =>
                              (await import('./routes/project')).loader(...args),
                            element: (
                              <Suspense fallback={<AppLoadingIndicator />}>
                                <Project />
                              </Suspense>
                            ),
                          },
                          {
                            path: 'list-workspaces',
                            loader: async (...args) =>
                              (
                                await import('./routes/project')
                              ).listWorkspacesLoader(...args),
                          },
                          {
                            path: 'delete',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).deleteProjectAction(...args),
                          },
                          {
                            path: 'move',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).moveProjectAction(...args),
                          },
                          {
                            path: 'move-workspace',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).moveWorkspaceIntoProjectAction(...args),
                          },
                          {
                            path: 'update',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).updateProjectAction(...args),
                          },
                          {
                            path: 'git',
                            children: [
                              {
                                path: 'clone',
                                action: async (...args) =>
                                  (
                                    await import('./routes/git-actions')
                                  ).cloneGitRepoAction(...args),
                              },
                              {
                                path: 'repo',
                                loader: async (...args) =>
                                  (await import('./routes/git-project-actions')).gitRepoLoader(...args),
                              },
                              {
                                path: 'changes',
                                loader: async (...args) =>
                                  (await import('./routes/git-project-actions')).gitChangesLoader(...args),
                              },
                              {
                                path: 'log',
                                loader: async (...args) =>
                                  (await import('./routes/git-project-actions')).gitLogLoader(...args),
                              },
                              {
                                path: 'branches',
                                loader: async (...args) =>
                                  (await import('./routes/git-project-actions')).gitBranchesLoader(...args),
                              },
                              {
                                path: 'status',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).gitStatusAction(...args),
                              },
                              {
                                path: 'commit',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).commitToGitRepoAction(...args),
                              },
                              {
                                path: 'commit-and-push',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).commitAndPushToGitRepoAction(...args),
                              },
                              {
                                path: 'fetch',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).gitFetchAction(...args),
                              },
                              {
                                path: 'update',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).updateGitRepoAction(...args),
                              },
                              {
                                path: 'reset',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).resetGitRepoAction(...args),
                              },
                              {
                                path: 'push',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).pushToGitRemoteAction(...args),
                              },
                              {
                                path: 'stage',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).stageChangesAction(...args),
                              },
                              {
                                path: 'unstage',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).unstageChangesAction(...args),
                              },
                              {
                                path: 'discard',
                                action: async (...args) =>
                                  (await import('./routes/git-project-actions')).discardChangesAction(...args),
                              },
                              {
                                path: 'diff',
                                loader: async (...args) =>
                                  (await import('./routes/git-project-actions')).diffFileLoader(...args),
                              },
                              {
                                path: 'branch',
                                children: [
                                  {
                                    path: 'new',
                                    action: async (...args) =>
                                      (await import('./routes/git-project-actions')).createNewGitBranchAction(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (await import('./routes/git-project-actions')).deleteGitBranchAction(...args),
                                  },
                                  {
                                    path: 'checkout',
                                    action: async (...args) =>
                                      (await import('./routes/git-project-actions')).checkoutGitBranchAction(...args),
                                  },
                                ],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        path: ':projectId/workspace',
                        children: [
                          {
                            path: ':workspaceId',
                            id: ':workspaceId',
                            loader: async (...args) =>
                              (
                                await import('./routes/workspace')
                              ).workspaceLoader(...args),
                            element: (
                              <Suspense fallback={<AppLoadingIndicator />}>
                                <Workspace />
                              </Suspense>
                            ),
                            children: [
                              {
                                path: `${ACTIVITY_DEBUG}/*`,
                                loader: async (...args) =>
                                  (await import('./routes/debug')).loader(
                                    ...args,
                                  ),
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <Debug />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'reorder',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).reorderCollectionAction(...args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId',
                                    id: 'request-group/:requestGroupId',
                                    loader: async (...args) =>
                                      (await import('./routes/request-group')).loader(
                                        ...args,
                                      ),
                                    element: <Outlet />,
                                  },
                                  {
                                    path: 'request/:requestId',
                                    id: 'request/:requestId',
                                    loader: async (...args) =>
                                      (await import('./routes/request')).loader(
                                        ...args,
                                      ),
                                    element: <Outlet />,
                                    children: [
                                      {
                                        path: 'send',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).sendAction(...args),
                                      },
                                      {
                                        path: 'connect',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).connectAction(...args),
                                      },
                                      {
                                        path: 'duplicate',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).duplicateRequestAction(...args),
                                      },
                                      {
                                        path: 'update',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).updateRequestAction(...args),
                                      },
                                      {
                                        path: 'update-meta',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).updateRequestMetaAction(...args),
                                      },
                                      {
                                        path: 'response/delete-all',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).deleteAllResponsesAction(...args),
                                      },
                                      {
                                        path: 'response/delete',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/request')
                                          ).deleteResponseAction(...args),
                                      },
                                    ],
                                  },
                                  {
                                    path: 'request/new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request')
                                      ).createRequestAction(...args),
                                  },
                                  {
                                    path: 'request/new-mock-send',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request')
                                      ).createAndSendToMockbinAction(...args),
                                  },
                                  {
                                    path: 'request/delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request')
                                      ).deleteRequestAction(...args),
                                  },
                                  {
                                    path: 'request-group/new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request-group')
                                      ).createRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request-group')
                                      ).deleteRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId/update',
                                    action: async (...args) => (await import('./routes/request-group')).updateRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/duplicate',
                                    action: async (...args) => (await import('./routes/request-group')).duplicateRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId/update-meta',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/request-group')
                                      ).updateRequestGroupMetaAction(...args),
                                  },
                                  {
                                    path: 'runner',
                                    loader: async (...args) =>
                                      (
                                        await import('./routes/runner')
                                      ).collectionRunnerStatusLoader(...args),
                                    element: <Outlet />,
                                    action: async (...args) =>
                                      (
                                        await import('./routes/runner')
                                      ).runCollectionAction(...args),
                                    children: [
                                      {
                                        path: 'run',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/runner')
                                          ).runCollectionAction(...args),
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: `${ACTIVITY_SPEC}`,
                                loader: async (...args) =>
                                  (await import('./routes/design')).loader(
                                    ...args,
                                  ),
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <Design />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateApiSpecAction(...args),
                                  },
                                  {
                                    path: 'generate-request-collection',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).generateCollectionFromApiSpecAction(
                                        ...args,
                                      ),
                                  },
                                ],
                              },
                              {
                                path: 'mock-server/*',
                                id: 'mock-server',
                                loader: async (...args) =>
                                  (await import('./routes/mock-server')).loader(
                                    ...args,
                                  ),
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <MockServer />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateMockServerAction(...args),
                                  },
                                  {
                                    path: 'mock-route',
                                    id: 'mock-route',
                                    children: [
                                      {
                                        path: ':mockRouteId',
                                        id: ':mockRouteId',
                                        loader: async (...args) =>
                                          (
                                            await import('./routes/mock-route')
                                          ).loader(...args),
                                        element: <Outlet />,
                                      },
                                      {
                                        path: 'new',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).createMockRouteAction(...args),
                                      },
                                      {
                                        path: ':mockRouteId/update',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).updateMockRouteAction(...args),
                                      },
                                      {
                                        path: ':mockRouteId/delete',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).deleteMockRouteAction(...args),
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'environment',
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <Environments />
                                  </Suspense>
                                ),
                              },
                              {
                                path: 'cacert',
                                children: [
                                  {
                                    path: 'new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).createNewCaCertificateAction(...args),
                                  },
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateCaCertificateAction(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).deleteCaCertificateAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'clientcert',
                                children: [
                                  {
                                    path: 'new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).createNewClientCertificateAction(...args),
                                  },
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateClientCertificateAction(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).deleteClientCertificateAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'environment',
                                children: [
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateEnvironment(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).deleteEnvironmentAction(...args),
                                  },
                                  {
                                    path: 'create',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).createEnvironmentAction(...args),
                                  },
                                  {
                                    path: 'duplicate',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).duplicateEnvironmentAction(...args),
                                  },
                                  {
                                    path: 'set-active',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).setActiveEnvironmentAction(...args),
                                  },
                                  {
                                    path: 'set-active-global',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).setActiveGlobalEnvironmentAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'cookieJar',
                                children: [
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/actions')
                                      ).updateCookieJarAction(...args),
                                  },
                                ],
                              },
                              {
                                path: 'test/*',
                                loader: async (...args) =>
                                  (await import('./routes/unit-test')).loader(
                                    ...args,
                                  ),
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <UnitTest />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    index: true,
                                    element: <Outlet />,
                                    loader: async (...args) =>
                                      (
                                        await import('./routes/test-suite')
                                      ).indexLoader(...args),
                                  },
                                  {
                                    path: 'test-suite',
                                    children: [
                                      {
                                        index: true,
                                        element: <Outlet />,
                                        loader: async (...args) =>
                                          (
                                            await import('./routes/test-suite')
                                          ).indexLoader(...args),
                                      },
                                      {
                                        path: 'new',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).createNewTestSuiteAction(...args),
                                      },
                                      {
                                        path: ':testSuiteId',
                                        id: ':testSuiteId',
                                        element: <Outlet />,
                                        loader: async (...args) =>
                                          (
                                            await import('./routes/test-suite')
                                          ).loader(...args),
                                        children: [
                                          {
                                            index: true,
                                            element: <Outlet />,
                                            loader: async (...args) =>
                                              (
                                                await import(
                                                  './routes/test-results'
                                                )
                                              ).indexLoader(...args),
                                          },
                                          {
                                            path: 'test-result',
                                            children: [
                                              {
                                                path: ':testResultId',
                                                id: ':testResultId',
                                                loader: async (...args) =>
                                                  (
                                                    await import(
                                                      './routes/test-results'
                                                    )
                                                  ).loader(...args),
                                              },
                                            ],
                                          },
                                          {
                                            path: 'delete',
                                            action: async (...args) =>
                                              (
                                                await import('./routes/actions')
                                              ).deleteTestSuiteAction(...args),
                                          },
                                          {
                                            path: 'update',
                                            action: async (...args) =>
                                              (
                                                await import('./routes/actions')
                                              ).updateTestSuiteAction(...args),
                                          },
                                          {
                                            path: 'run-all-tests',
                                            action: async (...args) =>
                                              (
                                                await import('./routes/actions')
                                              ).runAllTestsAction(...args),
                                          },
                                          {
                                            path: 'test',
                                            children: [
                                              {
                                                path: 'new',
                                                action: async (...args) =>
                                                  (
                                                    await import(
                                                      './routes/actions'
                                                    )
                                                  ).createNewTestAction(...args),
                                              },
                                              {
                                                path: ':testId',
                                                children: [
                                                  {
                                                    path: 'delete',
                                                    action: async (...args) =>
                                                      (
                                                        await import(
                                                          './routes/actions'
                                                        )
                                                      ).deleteTestAction(...args),
                                                  },
                                                  {
                                                    path: 'update',
                                                    action: async (...args) =>
                                                      (
                                                        await import(
                                                          './routes/actions'
                                                        )
                                                      ).updateTestAction(...args),
                                                  },
                                                  {
                                                    path: 'run',
                                                    action: async (...args) =>
                                                      (
                                                        await import(
                                                          './routes/actions'
                                                        )
                                                      ).runTestAction(...args),
                                                  },
                                                ],
                                              },
                                            ],
                                          },
                                        ],
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'ai',
                                children: [
                                  {
                                    path: 'generate',
                                    children: [
                                      {
                                        path: 'collection-and-tests',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).generateCollectionAndTestsAction(
                                            ...args,
                                          ),
                                      },
                                      {
                                        path: 'tests',
                                        action: async (...args) =>
                                          (
                                            await import('./routes/actions')
                                          ).generateTestsAction(...args),
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'duplicate',
                                action: async (...args) =>
                                  (
                                    await import('./routes/actions')
                                  ).duplicateWorkspaceAction(...args),
                              },
                              {
                                path: 'git',
                                children: [
                                  {
                                    path: 'repo',
                                    loader: async (...args) =>
                                      (await import('./routes/git-actions')).gitRepoLoader(...args),
                                  },
                                  {
                                    path: 'changes',
                                    loader: async (...args) =>
                                      (await import('./routes/git-actions')).gitChangesLoader(...args),
                                  },
                                  {
                                    path: 'log',
                                    loader: async (...args) =>
                                      (await import('./routes/git-actions')).gitLogLoader(...args),
                                  },
                                  {
                                    path: 'branches',
                                    loader: async (...args) =>
                                      (await import('./routes/git-actions')).gitBranchesLoader(...args),
                                  },
                                  {
                                    path: 'status',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).gitStatusAction(...args),
                                  },
                                  {
                                    path: 'commit',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).commitToGitRepoAction(...args),
                                  },
                                  {
                                    path: 'commit-and-push',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).commitAndPushToGitRepoAction(...args),
                                  },
                                  {
                                    path: 'fetch',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).gitFetchAction(...args),
                                  },
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).updateGitRepoAction(...args),
                                  },
                                  {
                                    path: 'reset',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).resetGitRepoAction(...args),
                                  },
                                  {
                                    path: 'push',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).pushToGitRemoteAction(...args),
                                  },
                                  {
                                    path: 'stage',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).stageChangesAction(...args),
                                  },
                                  {
                                    path: 'unstage',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).unstageChangesAction(...args),
                                  },
                                  {
                                    path: 'discard',
                                    action: async (...args) =>
                                      (await import('./routes/git-actions')).discardChangesAction(...args),
                                  },
                                  {
                                    path: 'diff',
                                    loader: async (...args) =>
                                      (await import('./routes/git-actions')).diffFileLoader(...args),
                                  },
                                  {
                                    path: 'branch',
                                    children: [
                                      {
                                        path: 'new',
                                        action: async (...args) =>
                                          (await import('./routes/git-actions')).createNewGitBranchAction(...args),
                                      },
                                      {
                                        path: 'delete',
                                        action: async (...args) =>
                                          (await import('./routes/git-actions')).deleteGitBranchAction(...args),
                                      },
                                      {
                                        path: 'checkout',
                                        action: async (...args) =>
                                          (await import('./routes/git-actions')).checkoutGitBranchAction(...args),
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'insomnia-sync',
                                children: [
                                  {
                                    path: 'sync-data',
                                    action: async (...args) =>
                                      (await import('./routes/remote-collections')).syncDataAction(...args),
                                    loader: async (...args) =>
                                      (await import('./routes/remote-collections')).syncDataLoader(...args),
                                  },
                                  {
                                    path: 'stage',
                                    action: async (...args) => (await import('./routes/remote-collections')).stageChangesAction(...args),
                                  },
                                  {
                                    path: 'unstage',
                                    action: async (...args) => (await import('./routes/remote-collections')).unstageChangesAction(...args),
                                  },
                                  {
                                    path: 'pull',
                                    action: async (...args) =>
                                      (await import('./routes/remote-collections')).pullFromRemoteAction(...args),
                                  },
                                  {
                                    path: 'push',
                                    action: async (...args) =>
                                      (await import('./routes/remote-collections')).pushToRemoteAction(...args),
                                  },
                                  {
                                    path: 'rollback',
                                    action: async (...args) =>
                                      (await import('./routes/remote-collections')).rollbackChangesAction(...args),
                                  },
                                  {
                                    path: 'restore',
                                    action: async (...args) =>
                                      (await import('./routes/remote-collections')).restoreChangesAction(...args),
                                  },
                                  {
                                    path: 'branch',
                                    children: [
                                      {
                                        path: 'checkout',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).checkoutBranchAction(...args),
                                      },
                                      {
                                        path: 'create',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).createBranchAction(...args),
                                      },
                                      {
                                        path: 'fetch',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).fetchRemoteBranchAction(...args),
                                      },
                                      {
                                        path: 'delete',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).deleteBranchAction(...args),
                                      },
                                      {
                                        path: 'merge',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).mergeBranchAction(...args),
                                      },
                                      {
                                        path: 'create-snapshot',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).createSnapshotAction(...args),
                                      },
                                      {
                                        path: 'create-snapshot-and-push',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).createSnapshotAndPushAction(...args),
                                      },
                                      {
                                        path: 'rollback',
                                        action: async (...args) =>
                                          (await import('./routes/remote-collections')).rollbackChangesAction(...args),
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'toggle-expand-all',
                                action: async (...args) => (await import('./routes/actions')).toggleExpandAllRequestGroupsAction(...args),
                              },
                            ],
                          },
                          {
                            path: 'new',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).createNewWorkspaceAction(...args),
                          },
                          {
                            path: 'delete',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).deleteWorkspaceAction(...args),
                          },
                          {
                            path: 'update',
                            action: async (...args) =>
                              (
                                await import('./routes/actions')
                              ).updateWorkspaceAction(...args),
                          },
                          {
                            path: ':workspaceId/update-meta',
                            action: async (...args) =>
                              (await import('./routes/actions')).updateWorkspaceMetaAction(
                                ...args
                              ),
                          },
                        ],
                      },
                      {
                        path: ':projectId/remote-collections',
                        loader: async (...args) =>
                          (
                            await import('./routes/remote-collections')
                          ).remoteLoader(...args),
                        children: [
                          {
                            path: 'pull',
                            action: async (...args) =>
                              (
                                await import('./routes/remote-collections')
                              ).pullRemoteCollectionAction(...args),
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            path: 'auth',
            element: <Suspense fallback={<AppLoadingIndicator />}>
              <Auth />
            </Suspense>,
            errorElement: <ErrorRoute defaultMessage='A temporarily unexpected error occurred, please reload to try again' />,
            children: [
              {
                path: 'login',
                action: async (...args) => (await import('./routes/auth.login')).action(...args),
                element: <Login />,
              },
              {
                path: 'logout',
                action: async (...args) => (await import('./routes/auth.logout')).action(...args),
              },
              {
                path: 'authorize',
                action: async (...args) => (await import('./routes/auth.authorize')).action(...args),
                element: <Authorize />,
              },
              {
                path: 'updateVaultSalt',
                action: async (...args) => (await import('./routes/auth.vaultKey')).updateVaultSaltAction(...args),
              },
              {
                path: 'createVaultKey',
                action: async (...args) => (await import('./routes/auth.vaultKey')).createVaultKeyAction(...args),
              },
              {
                path: 'validateVaultKey',
                action: async (...args) => (await import('./routes/auth.vaultKey')).validateVaultKeyAction(...args),
              },
              {
                path: 'resetVaultKey',
                action: async (...args) => (await import('./routes/auth.vaultKey')).resetVaultKeyAction(...args),
              },
              {
                path: 'clearVaultKey',
                action: async (...args) => (await import('./routes/auth.vaultKey')).clearVaultKeyAction(...args),
              },
            ],
          },
        ],
      },
    ],
    {
      initialEntries: [initialEntry],
    }
  );

  // Store the last location in local storage
  router.subscribe(({ location, navigation }) => {
    const match = matchPath(
      {
        path: '/organization/:organizationId',
        end: false,
      },
      location.pathname
    );
    const nextRoute = navigation.location?.pathname;
    const currentRoute = location.pathname;
    // Use navigation send tracking events on page change
    const bothHaveValueButNotEqual = nextRoute && currentRoute && nextRoute !== currentRoute;
    if (bothHaveValueButNotEqual) {
      // transforms /organization/:org_* to /organization/:org_id
      const routeWithoutUUID = nextRoute.replace(/_[a-f0-9]{32}/g, '_id');
      window.main.trackPageView({ name: routeWithoutUUID });
    }

    match?.params.organizationId && localStorage.setItem(`locationHistoryEntry:${match.params.organizationId}`, currentRoute);
    match?.params.organizationId && localStorage.setItem('lastVisitedOrganizationId', match.params.organizationId);
  });

  ReactDOM.createRoot(root).render(
    <RouterProvider router={router} />
  );
}

renderApp();

// Export some useful things for dev
if (isDevelopment()) {
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.models = models;
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.db = database;
}
