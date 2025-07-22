import './rendererListeners';

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { createMemoryRouter, matchPath, Outlet, RouterProvider } from 'react-router';

import { migrateFromLocalStorage, type SessionData, setSessionData, setVaultSessionData } from '../account/session';
import {
  ACTIVITY_DEBUG,
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
import { HtmlElementWrapper } from './components/html-element-wrapper';
import { showModal } from './components/modals';
import { AlertModal } from './components/modals/alert-modal';
import { PromptModal } from './components/modals/prompt-modal';
import { WrapperModal } from './components/modals/wrapper-modal';
import Auth from './routes/auth';
import Authorize from './routes/auth.authorize';
import Login from './routes/auth.login';
import { ErrorRoute } from './routes/error';
import Onboarding from './routes/onboarding';
import { Migrate } from './routes/onboarding.migrate';
import Root from './routes/root';
import { initializeSentry } from './sentry';
const Organization = lazy(() => import('./routes/organization'));
const Project = lazy(() => import('./routes/$organizationId.project.$projectId'));
const Workspace = lazy(() => import('./routes/$organizationId.project.$projectId.workspace.$workspaceId'));
const UnitTest = lazy(() => import('./routes/$organizationId.project.$projectId.workspace.$workspaceId.unit-test'));
const Debug = lazy(() => import('./routes/$organizationId.project.$projectId.workspace.$workspaceId.debug'));
const Design = lazy(() => import('./routes/$organizationId.project.$projectId.workspace.$workspaceId.spec'));
const MockServer = lazy(() => import('./routes/$organizationId.project.$projectId.workspace.$workspaceId.mock-server'));
const Environments = lazy(
  () => import('./routes/$organizationId.project.$projectId.workspace.$workspaceId.environment'),
);

initializeSentry();
initializeLogging();
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

try {
  window.showAlert = options => showModal(AlertModal, options);
  window.showPrompt = options =>
    showModal(PromptModal, {
      ...options,
      title: options?.title || '',
    });
  window.showWrapper = options =>
    showModal(WrapperModal, {
      ...options,
      title: options?.title || '',
      body: <HtmlElementWrapper el={options?.body} onUnmount={options?.onHide} />,
    });

  // In order to run playwight tests that simulate a logged in user
  // we need to inject state into localStorage
  const skipOnboarding = getSkipOnboarding();
  if (skipOnboarding) {
    window.localStorage.setItem('hasSeenOnboardingV11', skipOnboarding.toString());
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
  const insomniaVaultKey = getInsomniaVaultKey() || '';
  const insomniaVaultSalt = getInsomniaVaultSalt() || '';
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
        session.encPrivateKey,
      );
      if (insomniaVaultSalt || insomniaVaultKey) {
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
            loader: async (...args) => (await import('./routes/git-credentials')).loadGitCredentials(...args),
            children: [
              {
                path: 'github',
                loader: async (...args) => (await import('./routes/git-credentials')).loadGitHubCredentials(...args),
                children: [
                  {
                    path: 'init-sign-in',
                    action: async (...args) => (await import('./routes/git-credentials')).initSignInToGitHub(...args),
                  },
                  {
                    path: 'complete-sign-in',
                    action: async (...args) =>
                      (await import('./routes/git-credentials')).completeSignInToGitHub(...args),
                  },
                  {
                    path: 'sign-out',
                    action: async (...args) => (await import('./routes/git-credentials')).signOutOfGitHub(...args),
                  },
                ],
              },
              {
                path: 'gitlab',
                loader: async (...args) => (await import('./routes/git-credentials')).loadGitLabCredentials(...args),
                children: [
                  {
                    path: 'init-sign-in',
                    action: async (...args) => (await import('./routes/git-credentials')).initSignInToGitLab(...args),
                  },
                  {
                    path: 'complete-sign-in',
                    action: async (...args) =>
                      (await import('./routes/git-credentials')).completeSignInToGitLab(...args),
                  },
                  {
                    path: 'sign-out',
                    action: async (...args) => (await import('./routes/git-credentials')).signOutOfGitLab(...args),
                  },
                ],
              },
            ],
          },
          {
            path: 'remote-files',
            loader: async args => (await import('./routes/remote-files')).loader(args),
          },
          {
            path: 'import',
            children: [
              {
                path: 'scan',
                action: async args => (await import('./routes/import.scan')).action(args),
              },
              {
                path: 'resources',
                action: async args => (await import('./routes/import.resources')).action(args),
              },
            ],
          },
          {
            path: 'settings/update',
            action: async args => (await import('./routes/settings.update')).action(args),
          },
          {
            path: 'untracked-projects',
            loader: async (...args) => (await import('./routes/untracked-projects')).loader(...args),
          },
          {
            path: 'organization',
            id: '/organization',
            loader: async args => (await import('./routes/organization')).loader(args),
            element: (
              <Suspense fallback={<AppLoadingIndicator />}>
                <Organization />
              </Suspense>
            ),
            errorElement: (
              <ErrorRoute defaultMessage="A temporarily unexpected error occurred, please reload to try again" />
            ),
            children: [
              {
                index: true,
                loader: async args => (await import('./routes/organization._index')).loader(args),
              },
              {
                path: 'sync',
                action: async args => (await import('./routes/organization.sync')).action(args),
              },
              {
                path: 'sync-organizations-and-projects',
                action: async args =>
                  (await import('./routes/organization.sync-organizations-and-projects')).action(args),
              },
              {
                path: ':organizationId',
                id: ':organizationId',
                children: [
                  {
                    index: true,
                    loader: async (...args) => (await import('./routes/$organizationId.project')).indexLoader(...args),
                  },
                  {
                    path: 'git',
                    children: [
                      {
                        path: 'init-clone',
                        action: async (...args) =>
                          (await import('./routes/$organizationId.git')).initGitCloneAction(...args),
                      },
                      {
                        path: 'clone',
                        action: async (...args) =>
                          (await import('./routes/$organizationId.git')).cloneGitRepoAction(...args),
                      },
                    ],
                  },
                  {
                    path: 'permissions',
                    loader: async args => (await import('./routes/$organizationId.permissions')).loader(args),
                    shouldRevalidate: data => data.currentParams.organizationId !== data.nextParams.organizationId,
                  },
                  {
                    path: 'storage-rules',
                    loader: async args => (await import('./routes/$organizationId.storage-rules')).loader(args),
                    action: async args => (await import('./routes/$organizationId.storage-rules')).action(args),
                  },
                  {
                    path: 'sync-projects',
                    action: async (...args) =>
                      (await import('./routes/$organizationId.project.$projectId')).syncProjectsAction(...args),
                  },
                  {
                    path: 'collaborators',
                    loader: async (...args) =>
                      (await import('./routes/$organizationId.collaborators')).collaboratorsListLoader(...args),
                  },
                  {
                    path: 'collaborators-search',
                    loader: async (...args) =>
                      (await import('./routes/$organizationId.collaborators-search')).collaboratorSearchLoader(...args),
                  },
                  {
                    path: 'invites',
                    children: [
                      {
                        path: ':invitationId',
                        id: ':invitationId',
                        action: async (...args) =>
                          (
                            await import('./routes/$organizationId.collaborators.invites.$invitationId')
                          ).updateInvitationRoleAction(...args),
                        children: [
                          {
                            path: 'reinvite',
                            action: async (...args) =>
                              (
                                await import('./routes/$organizationId.collaborators.invites.$invitationId.reinvite')
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
                              (await import('./routes/$organizationId.members.$userId.roles')).updateMemberRoleAction(
                                ...args,
                              ),
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
                          (await import('./routes/$organizationId.project.$projectId')).loader(...args),
                        element: (
                          <Suspense fallback={<AppLoadingIndicator />}>
                            <Project />
                          </Suspense>
                        ),
                      },
                      {
                        path: 'new',
                        action: async args => (await import('./routes/$organizationId.project.new')).action(args),
                      },
                      {
                        path: ':projectId',
                        id: '/project/:projectId',
                        loader: async (...args) =>
                          (await import('./routes/$organizationId.project.$projectId')).projectIdLoader(...args),
                        children: [
                          {
                            index: true,
                            loader: async (...args) =>
                              (await import('./routes/$organizationId.project.$projectId')).loader(...args),
                            element: (
                              <Suspense fallback={<AppLoadingIndicator />}>
                                <Project />
                              </Suspense>
                            ),
                          },
                          {
                            path: 'list-workspaces',
                            loader: async (...args) =>
                              (await import('./routes/$organizationId.project.$projectId')).listWorkspacesLoader(
                                ...args,
                              ),
                          },
                          {
                            path: 'delete',
                            action: async args =>
                              (await import('./routes/$organizationId.project.$projectId.delete')).action(args),
                          },
                          {
                            path: 'move',
                            action: async args =>
                              (await import('./routes/$organizationId.project.$projectId.move')).action(args),
                          },
                          {
                            path: 'move-workspace',
                            action: async args =>
                              (await import('./routes/$organizationId.project.$projectId.move-workspace')).action(args),
                          },
                          {
                            path: 'update',
                            action: async args =>
                              (await import('./routes/$organizationId.project.$projectId.update')).action(args),
                          },
                          {
                            path: 'git',
                            children: [
                              {
                                path: 'clone',
                                action: async (...args) =>
                                  (
                                    await import(
                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                    )
                                  ).cloneGitRepoAction(...args),
                              },
                              {
                                path: 'repo',
                                loader: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).gitRepoLoader(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'changes',
                                loader: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).gitChangesLoader(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'log',
                                loader: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).gitLogLoader(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'branches',
                                loader: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).gitBranchesLoader(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'status',
                                action: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).gitStatusAction(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'commit',
                                action: async (...args) =>
                                  (
                                    await import('./routes/$organizationId.project.$projectId.git')
                                  ).commitToGitRepoAction(...args),
                              },
                              {
                                path: 'commit-and-push',
                                action: async (...args) =>
                                  (
                                    await import('./routes/$organizationId.project.$projectId.git')
                                  ).commitAndPushToGitRepoAction(...args),
                              },
                              {
                                path: 'fetch',
                                action: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).gitFetchAction(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'update',
                                action: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).updateGitRepoAction(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'reset',
                                action: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).resetGitRepoAction(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'push',
                                action: async (...args) =>
                                  (
                                    await import('./routes/$organizationId.project.$projectId.git')
                                  ).pushToGitRemoteAction(...args),
                              },
                              {
                                path: 'stage',
                                action: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).stageChangesAction(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'unstage',
                                action: async (...args) =>
                                  (
                                    await import('./routes/$organizationId.project.$projectId.git')
                                  ).unstageChangesAction(...args),
                              },
                              {
                                path: 'discard',
                                action: async (...args) =>
                                  (
                                    await import('./routes/$organizationId.project.$projectId.git')
                                  ).discardChangesAction(...args),
                              },
                              {
                                path: 'diff',
                                loader: async (...args) =>
                                  (await import('./routes/$organizationId.project.$projectId.git')).diffFileLoader(
                                    ...args,
                                  ),
                              },
                              {
                                path: 'repository-tree',
                                loader: async (...args) =>
                                  (
                                    await import('./routes/$organizationId.project.$projectId.git')
                                  ).getRepositoryDirectoryTree(...args),
                              },
                              {
                                path: 'migrate-legacy-insomnia-folder-to-file',
                                action: async (...args) =>
                                  (
                                    await import('./routes/$organizationId.project.$projectId.git')
                                  ).migrateLegacyInsomniaFolderToFile(...args),
                              },
                              {
                                path: 'branch',
                                children: [
                                  {
                                    path: 'new',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.git')
                                      ).createNewGitBranchAction(...args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.git')
                                      ).deleteGitBranchAction(...args),
                                  },
                                  {
                                    path: 'checkout',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.git')
                                      ).checkoutGitBranchAction(...args),
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
                                await import('./routes/$organizationId.project.$projectId.workspace.$workspaceId')
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
                                  (
                                    await import(
                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug'
                                    )
                                  ).loader(...args),
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <Debug />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'reorder',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.reorder'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId',
                                    id: 'request-group/:requestGroupId',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId'
                                        )
                                      ).loader(...args),
                                    element: <Outlet />,
                                  },
                                  {
                                    path: 'request/:requestId',
                                    id: 'request/:requestId',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                        )
                                      ).loader(...args),
                                    element: <Outlet />,
                                    children: [
                                      {
                                        path: 'send',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).sendAction(...args),
                                      },
                                      {
                                        path: 'connect',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).connectAction(...args),
                                      },
                                      {
                                        path: 'duplicate',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).duplicateRequestAction(...args),
                                      },
                                      {
                                        path: 'update',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).updateRequestAction(...args),
                                      },
                                      {
                                        path: 'update-meta',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).updateRequestMetaAction(...args),
                                      },
                                      {
                                        path: 'response/delete-all',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).deleteAllResponsesAction(...args),
                                      },
                                      {
                                        path: 'response/delete',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).deleteResponseAction(...args),
                                      },
                                      {
                                        path: 'update-payload',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                            )
                                          ).updatePayloadAction(...args),
                                      },
                                    ],
                                  },
                                  {
                                    path: 'request/new',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                        )
                                      ).createRequestAction(...args),
                                  },
                                  {
                                    path: 'request/new-mock-send',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                        )
                                      ).createAndSendToMockbinAction(...args),
                                  },
                                  {
                                    path: 'request/delete',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId'
                                        )
                                      ).deleteRequestAction(...args),
                                  },
                                  {
                                    path: 'request-group/new',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId'
                                        )
                                      ).createRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/delete',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId'
                                        )
                                      ).deleteRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId/update',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId'
                                        )
                                      ).updateRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/duplicate',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId'
                                        )
                                      ).duplicateRequestGroupAction(...args),
                                  },
                                  {
                                    path: 'request-group/:requestGroupId/update-meta',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId'
                                        )
                                      ).updateRequestGroupMetaAction(...args),
                                  },
                                  {
                                    path: 'runner',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.runner'
                                        )
                                      ).collectionRunnerStatusLoader(...args),
                                    element: <Outlet />,
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.runner'
                                        )
                                      ).runCollectionAction(...args),
                                    children: [
                                      {
                                        path: 'run',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.debug.runner'
                                            )
                                          ).runCollectionAction(...args),
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'spec',
                                loader: async (...args) =>
                                  (
                                    await import(
                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.spec'
                                    )
                                  ).loader(...args),
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <Design />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'update',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.spec.update'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'generate-request-collection',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.spec.generate-request-collection'
                                        )
                                      ).action(args),
                                  },
                                ],
                              },
                              {
                                path: 'mock-server/*',
                                id: 'mock-server',
                                loader: async (...args) =>
                                  (
                                    await import(
                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.mock-server'
                                    )
                                  ).loader(...args),
                                element: (
                                  <Suspense fallback={<AppLoadingIndicator />}>
                                    <MockServer />
                                  </Suspense>
                                ),
                                children: [
                                  {
                                    path: 'mock-route',
                                    id: 'mock-route',
                                    children: [
                                      {
                                        path: ':mockRouteId',
                                        id: ':mockRouteId',
                                        loader: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId'
                                            )
                                          ).loader(...args),
                                        element: <Outlet />,
                                      },
                                      {
                                        path: 'new',
                                        action: async args =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.new'
                                            )
                                          ).action(args),
                                      },
                                      {
                                        path: ':mockRouteId/update',
                                        action: async args =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.update'
                                            )
                                          ).action(args),
                                      },
                                      {
                                        path: ':mockRouteId/delete',
                                        action: async args =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.mock-server.mock-route.$mockRouteId.delete'
                                            )
                                          ).action(args),
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
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.cacert.new'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'update',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.cacert.update'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.cacert.delete'
                                        )
                                      ).action(args),
                                  },
                                ],
                              },
                              {
                                path: 'clientcert',
                                children: [
                                  {
                                    path: 'new',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.clientcert.new'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'update',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.clientcert.update'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.clientcert.delete'
                                        )
                                      ).action(args),
                                  },
                                ],
                              },
                              {
                                path: 'environment',
                                children: [
                                  {
                                    path: 'update',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.environment.update'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'delete',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.environment.delete'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'create',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.environment.create'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'duplicate',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.environment.duplicate'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'set-active',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.environment.set-active'
                                        )
                                      ).action(args),
                                  },
                                  {
                                    path: 'set-active-global',
                                    action: async args =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.environment.set-active-global'
                                        )
                                      ).action(args),
                                  },
                                ],
                              },
                              {
                                path: 'update-cookie-jar',
                                action: async args =>
                                  (
                                    await import(
                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.update-cookie-jar'
                                    )
                                  ).action(args),
                              },
                              {
                                path: 'test/*',
                                loader: async (...args) =>
                                  (
                                    await import(
                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.unit-test'
                                    )
                                  ).loader(...args),
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
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId'
                                        )
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
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId'
                                            )
                                          ).indexLoader(...args),
                                      },
                                      {
                                        path: 'new',
                                        action: async args =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.new'
                                            )
                                          ).action(args),
                                      },
                                      {
                                        path: ':testSuiteId',
                                        id: ':testSuiteId',
                                        element: <Outlet />,
                                        loader: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId'
                                            )
                                          ).loader(...args),
                                        children: [
                                          {
                                            index: true,
                                            element: <Outlet />,
                                            loader: async (...args) =>
                                              (
                                                await import(
                                                  './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.test-result.$testResultId'
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
                                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.test-result.$testResultId'
                                                    )
                                                  ).loader(...args),
                                              },
                                            ],
                                          },
                                          {
                                            path: 'delete',
                                            action: async args =>
                                              (
                                                await import(
                                                  './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.delete'
                                                )
                                              ).action(args),
                                          },
                                          {
                                            path: 'update',
                                            action: async args =>
                                              (
                                                await import(
                                                  './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.update'
                                                )
                                              ).action(args),
                                          },
                                          {
                                            path: 'run-all-tests',
                                            action: async args =>
                                              (
                                                await import(
                                                  './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.run-all-tests'
                                                )
                                              ).action(args),
                                          },
                                          {
                                            path: 'test',
                                            children: [
                                              {
                                                path: 'new',
                                                action: async args =>
                                                  (
                                                    await import(
                                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.test.new'
                                                    )
                                                  ).action(args),
                                              },
                                              {
                                                path: ':testId',
                                                children: [
                                                  {
                                                    path: 'delete',
                                                    action: async args =>
                                                      (
                                                        await import(
                                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.test.$testId.delete'
                                                        )
                                                      ).action(args),
                                                  },
                                                  {
                                                    path: 'update',
                                                    action: async args =>
                                                      (
                                                        await import(
                                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.test.$testId.update'
                                                        )
                                                      ).action(args),
                                                  },
                                                  {
                                                    path: 'run',
                                                    action: async args =>
                                                      (
                                                        await import(
                                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.test-suite.$testSuiteId.test.$testId.run'
                                                        )
                                                      ).action(args),
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
                                path: 'duplicate',
                                action: async args =>
                                  (await import('./routes/$organizationId.project.$projectId.workspace.move')).action(
                                    args,
                                  ),
                              },
                              {
                                path: 'git',
                                children: [
                                  {
                                    path: 'repo',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).gitRepoLoader(...args),
                                  },
                                  {
                                    path: 'changes',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).gitChangesLoader(...args),
                                  },
                                  {
                                    path: 'log',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).gitLogLoader(...args),
                                  },
                                  {
                                    path: 'branches',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).gitBranchesLoader(...args),
                                  },
                                  {
                                    path: 'status',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).gitStatusAction(...args),
                                  },
                                  {
                                    path: 'commit',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).commitToGitRepoAction(...args),
                                  },
                                  {
                                    path: 'commit-and-push',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).commitAndPushToGitRepoAction(...args),
                                  },
                                  {
                                    path: 'fetch',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).gitFetchAction(...args),
                                  },
                                  {
                                    path: 'update',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).updateGitRepoAction(...args),
                                  },
                                  {
                                    path: 'reset',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).resetGitRepoAction(...args),
                                  },
                                  {
                                    path: 'push',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).pushToGitRemoteAction(...args),
                                  },
                                  {
                                    path: 'stage',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).stageChangesAction(...args),
                                  },
                                  {
                                    path: 'unstage',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).unstageChangesAction(...args),
                                  },
                                  {
                                    path: 'discard',
                                    action: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).discardChangesAction(...args),
                                  },
                                  {
                                    path: 'diff',
                                    loader: async (...args) =>
                                      (
                                        await import(
                                          './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                        )
                                      ).diffFileLoader(...args),
                                  },
                                  {
                                    path: 'branch',
                                    children: [
                                      {
                                        path: 'new',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                            )
                                          ).createNewGitBranchAction(...args),
                                      },
                                      {
                                        path: 'delete',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                            )
                                          ).deleteGitBranchAction(...args),
                                      },
                                      {
                                        path: 'checkout',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.workspace.$workspaceId.git'
                                            )
                                          ).checkoutGitBranchAction(...args),
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
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).syncDataAction(...args),
                                    loader: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).syncDataLoader(...args),
                                  },
                                  {
                                    path: 'stage',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).stageChangesAction(...args),
                                  },
                                  {
                                    path: 'unstage',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).unstageChangesAction(...args),
                                  },
                                  {
                                    path: 'pull',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).pullFromRemoteAction(...args),
                                  },
                                  {
                                    path: 'push',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).pushToRemoteAction(...args),
                                  },
                                  {
                                    path: 'rollback',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).rollbackChangesAction(...args),
                                  },
                                  {
                                    path: 'restore',
                                    action: async (...args) =>
                                      (
                                        await import('./routes/$organizationId.project.$projectId.remote-collections')
                                      ).restoreChangesAction(...args),
                                  },
                                  {
                                    path: 'branch',
                                    children: [
                                      {
                                        path: 'checkout',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).checkoutBranchAction(...args),
                                      },
                                      {
                                        path: 'create',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).createBranchAction(...args),
                                      },
                                      {
                                        path: 'fetch',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).fetchRemoteBranchAction(...args),
                                      },
                                      {
                                        path: 'delete',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).deleteBranchAction(...args),
                                      },
                                      {
                                        path: 'merge',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).mergeBranchAction(...args),
                                      },
                                      {
                                        path: 'create-snapshot',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).createSnapshotAction(...args),
                                      },
                                      {
                                        path: 'create-snapshot-and-push',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).createSnapshotAndPushAction(...args),
                                      },
                                      {
                                        path: 'rollback',
                                        action: async (...args) =>
                                          (
                                            await import(
                                              './routes/$organizationId.project.$projectId.remote-collections'
                                            )
                                          ).rollbackChangesAction(...args),
                                      },
                                    ],
                                  },
                                ],
                              },
                              {
                                path: 'toggle-expand-all',
                                action: async args =>
                                  (
                                    await import(
                                      './routes/$organizationId.project.$projectId.workspace.$workspaceId.toggle-expand-all'
                                    )
                                  ).action(args),
                              },
                            ],
                          },
                          {
                            path: 'new',
                            action: async args =>
                              (await import('./routes/$organizationId.project.$projectId.workspace.new')).action(args),
                          },
                          {
                            path: 'delete',
                            action: async args =>
                              (await import('./routes/$organizationId.project.$projectId.workspace.delete')).action(
                                args,
                              ),
                          },
                          {
                            path: 'update',
                            action: async args =>
                              (await import('./routes/$organizationId.project.$projectId.workspace.update')).action(
                                args,
                              ),
                          },
                          {
                            path: ':workspaceId/update-meta',
                            action: async args =>
                              (
                                await import(
                                  './routes/$organizationId.project.$projectId.workspace.$workspaceId.update-meta'
                                )
                              ).action(args),
                          },
                        ],
                      },
                      {
                        path: ':projectId/remote-collections',
                        loader: async (...args) =>
                          (await import('./routes/$organizationId.project.$projectId.remote-collections')).remoteLoader(
                            ...args,
                          ),
                        children: [
                          {
                            path: 'pull',
                            action: async (...args) =>
                              (
                                await import('./routes/$organizationId.project.$projectId.remote-collections')
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
            element: (
              <Suspense fallback={<AppLoadingIndicator />}>
                <Auth />
              </Suspense>
            ),
            errorElement: (
              <ErrorRoute defaultMessage="A temporarily unexpected error occurred, please reload to try again" />
            ),
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
                path: 'update-vault-salt',
                action: async args => (await import('./routes/auth.update-vault-salt')).action(args),
              },
              {
                path: 'create-vault-key',
                action: async args => (await import('./routes/auth.create-vault-key')).action(args),
              },
              {
                path: 'validate-vault-key',
                action: async args => (await import('./routes/auth.validate-vault-key')).action(args),
              },
              {
                path: 'reset-vault-key',
                action: async args => (await import('./routes/auth.reset-vault-key')).action(args),
              },
              {
                path: 'clear-vault-key',
                action: async args => (await import('./routes/auth.clear-vault-key')).action(args),
              },
            ],
          },
        ],
      },
    ],
    {
      initialEntries: [initialEntry],
    },
  );

  // Store the last location in local storage
  router.subscribe(({ location, navigation }) => {
    const match = matchPath(
      {
        path: '/organization/:organizationId',
        end: false,
      },
      location.pathname,
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

    match?.params.organizationId &&
      localStorage.setItem(`locationHistoryEntry:${match.params.organizationId}`, currentRoute);
    match?.params.organizationId && localStorage.setItem('lastVisitedOrganizationId', match.params.organizationId);
  });

  ReactDOM.createRoot(root).render(<RouterProvider router={router} />);
}

renderApp();

// Export some useful things for dev
if (isDevelopment()) {
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.models = models;
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.db = database;
}
