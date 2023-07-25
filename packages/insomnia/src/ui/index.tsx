import './rendererListeners';

import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import {
  createMemoryRouter,
  matchPath,
  RouterProvider,
} from 'react-router-dom';
import { Store } from 'redux';

import {
  ACTIVITY_DEBUG,
  ACTIVITY_HOME,
  ACTIVITY_SPEC,
  ACTIVITY_UNIT_TEST,
  getProductName,
  isDevelopment,
} from '../common/constants';
import { database } from '../common/database';
import { initializeLogging } from '../common/log';
import * as models from '../models';
import { DEFAULT_ORGANIZATION_ID } from '../models/organization';
import { DEFAULT_PROJECT_ID } from '../models/project';
import { initNewOAuthSession } from '../network/o-auth-2/get-token';
import { init as initPlugins } from '../plugins';
import { applyColorScheme } from '../plugins/misc';
import { invariant } from '../utils/invariant';
import { AppLoadingIndicator } from './components/app-loading-indicator';
import { init as initStore } from './redux/modules';
import {
  setActiveProject,
  setActiveWorkspace,
} from './redux/modules/global';
import { ErrorRoute } from './routes/error';
import Root from './routes/root';
import { initializeSentry } from './sentry';

const Project = lazy(() => import('./routes/project'));
const Workspace = lazy(() => import('./routes/workspace'));
const UnitTest = lazy(() => import('./routes/unit-test'));
const Debug = lazy(() => import('./routes/debug'));
const Design = lazy(() => import('./routes/design'));

initializeSentry();
initializeLogging();
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

let locationHistoryEntry = `/organization/${DEFAULT_ORGANIZATION_ID}/project/${DEFAULT_PROJECT_ID}`;
const prevLocationHistoryEntry = localStorage.getItem('locationHistoryEntry');

if (prevLocationHistoryEntry && matchPath({ path: '/organization/:organizationId', end: false }, prevLocationHistoryEntry)) {
  locationHistoryEntry = prevLocationHistoryEntry;
}

const router = createMemoryRouter(
  // @TODO - Investigate file based routing to generate these routes:
  [
    {
      path: '/',
      id: 'root',
      loader: async (...args) => (await import('./routes/root')).loader(...args),
      element: <Root />,
      errorElement: <ErrorRoute />,
      children: [
        {
          path: 'import',
          children: [
            {
              path: 'scan',
              action: async (...args) => (await import('./routes/import')).scanForResourcesAction(...args),
            },
            {
              path: 'resources',
              action: async (...args) => (await import('./routes/import')).importResourcesAction(...args),
            },
          ],
        },
        {
          path: 'organization',
          children: [
            {
              path: ':organizationId',
              children: [
                {
                  index: true,
                  loader: async (...args) => (await import('./routes/project')).indexLoader(...args),
                },
                {
                  path: 'project',
                  children: [
                    {
                      path: ':projectId',
                      id: '/project/:projectId',
                      loader: async (...args) =>
                        (await import('./routes/project')).loader(...args),
                      element: (
                        <Suspense fallback={<AppLoadingIndicator />}>
                          <Project />
                        </Suspense>
                      ),
                      children: [
                        {
                          path: 'delete',
                          action: async (...args) =>
                            (await import('./routes/actions')).deleteProjectAction(
                              ...args
                            ),
                        },
                        {
                          path: 'rename',
                          action: async (...args) =>
                            (await import('./routes/actions')).renameProjectAction(
                              ...args
                            ),
                        },
                        {
                          path: 'git',
                          children: [
                            {
                              path: 'clone',
                              action: async (...args) => (await import('./routes/git-actions')).cloneGitRepoAction(...args),
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
                          loader: async (...args) => (await import('./routes/workspace')).workspaceLoader(...args),
                          element: <Suspense fallback={<AppLoadingIndicator />}><Workspace /></Suspense>,
                          children: [
                            {
                              path: `${ACTIVITY_DEBUG}`,
                              element: (
                                <Suspense fallback={<AppLoadingIndicator />}>
                                  <Debug />
                                </Suspense>
                              ),
                            },
                            {
                              path: `${ACTIVITY_SPEC}`,
                              loader: async (...args) => (await import('./routes/design')).loader(...args),
                              element: (
                                <Suspense fallback={<AppLoadingIndicator />}>
                                  <Design />
                                </Suspense>
                              ),
                              children: [
                                {
                                  path: 'update',
                                  action: async (...args) => (await import('./routes/actions')).updateApiSpecAction(...args),
                                },
                                {
                                  path: 'generate-request-collection',
                                  action: async (...args) => (await import('./routes/actions')).generateCollectionFromApiSpecAction(...args),
                                },
                              ],
                            },
                            {
                              path: 'environment',
                              children: [
                                {
                                  path: 'update',
                                  action: async (...args) => (await import('./routes/actions')).updateEnvironment(...args),
                                },
                                {
                                  path: 'delete',
                                  action: async (...args) => (await import('./routes/actions')).deleteEnvironmentAction(...args),
                                },
                                {
                                  path: 'create',
                                  action: async (...args) => (await import('./routes/actions')).createEnvironmentAction(...args),
                                },
                                {
                                  path: 'duplicate',
                                  action: async (...args) => (await import('./routes/actions')).duplicateEnvironmentAction(...args),
                                },
                                {
                                  path: 'set-active',
                                  action: async (...args) => (await import('./routes/actions')).setActiveEnvironmentAction(...args),
                                },
                              ],
                            },
                            {
                              path: 'test/*',
                              loader: async (...args) =>  (await import('./routes/unit-test')).loader(...args),
                              element: (
                                <Suspense fallback={<AppLoadingIndicator />}>
                                  <UnitTest />
                                </Suspense>
                              ),
                              children: [
                                {
                                  index: true,
                                  loader: async (...args) => (await import('./routes/test-suite')).indexLoader(...args),
                                },
                                {
                                  path: 'test-suite',
                                  children: [
                                    {
                                      index: true,
                                      loader: async (...args) => (await import('./routes/test-suite')).indexLoader(...args),
                                    },
                                    {
                                      path: 'new',
                                      action: async (...args) => (await import('./routes/actions')).createNewTestSuiteAction(...args),
                                    },
                                    {
                                      path: ':testSuiteId',
                                      id: ':testSuiteId',
                                      loader: async (...args) => (await import('./routes/test-suite')).loader(...args),
                                      children: [
                                        {
                                          index: true,
                                          loader: async (...args) => (await import('./routes/test-results')).indexLoader(...args),
                                        },
                                        {
                                          path: 'test-result',
                                          children: [
                                            {
                                              path: ':testResultId',
                                              id: ':testResultId',
                                              loader: async (...args) => (await import('./routes/test-results')).loader(...args),
                                            },
                                          ],
                                        },
                                        {
                                          path: 'delete',
                                          action: async (...args) => (await import('./routes/actions')).deleteTestSuiteAction(...args),
                                        },
                                        {
                                          path: 'rename',
                                          action: async (...args) => (await import('./routes/actions')).renameTestSuiteAction(...args),
                                        },
                                        {
                                          path: 'run-all-tests',
                                          action: async (...args) => (await import('./routes/actions')).runAllTestsAction(...args),
                                        },
                                        {
                                          path: 'test',
                                          children: [
                                            {
                                              path: 'new',
                                              action: async (...args) => (await import('./routes/actions')).createNewTestAction(...args),
                                            },
                                            {
                                              path: ':testId',
                                              children: [
                                                {
                                                  path: 'delete',
                                                  action: async (...args) => (await import('./routes/actions')).deleteTestAction(...args),
                                                },
                                                {
                                                  path: 'update',
                                                  action: async (...args) => (await import('./routes/actions')).updateTestAction(...args),
                                                },
                                                {
                                                  path: 'run',
                                                  action: async (...args) => (await import('./routes/actions')).runTestAction(...args),
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
                                      action: async (...args) => (await import('./routes/actions')).generateCollectionAndTestsAction(...args),
                                    },
                                    {
                                      path: 'tests',
                                      action: async (...args) => (await import('./routes/actions')).generateTestsAction(...args),
                                    },
                                  ],
                                },
                                {
                                  path: 'access',
                                  action: async (...args) => (await import('./routes/actions')).accessAIApiAction(...args),
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
                                  path: 'status',
                                  loader: async (...args) => (await import('./routes/git-actions')).gitStatusLoader(...args),
                                },
                                {
                                  path: 'changes',
                                  loader: async (...args) => (await import('./routes/git-actions')).gitChangesLoader(...args),
                                },
                                {
                                  path: 'commit',
                                  action: async (...args) => (await import('./routes/git-actions')).commitToGitRepoAction(...args),
                                },
                                {
                                  path: 'branches',
                                  loader: async (...args) => (await import('./routes/git-actions')).gitBranchesLoader(...args),
                                },
                                {
                                  path: 'log',
                                  loader: async (...args) => (await import('./routes/git-actions')).gitLogLoader(...args),
                                },
                                {
                                  path: 'fetch',
                                  action: async (...args) => (await import('./routes/git-actions')).gitFetchAction(...args),
                                },
                                {
                                  path: 'branch',
                                  children: [
                                    {
                                      path: 'new',
                                      action: async (...args) => (await import('./routes/git-actions')).createNewGitBranchAction(...args),
                                    },
                                    {
                                      path: 'delete',
                                      action: async (...args) => (await import('./routes/git-actions')).deleteGitBranchAction(...args),
                                    },
                                    {
                                      path: 'checkout',
                                      action: async (...args) => (await import('./routes/git-actions')).checkoutGitBranchAction(...args),
                                    },
                                    {
                                      path: 'merge',
                                      action: async (...args) => (await import('./routes/git-actions')).mergeGitBranchAction(...args),
                                    },
                                  ],
                                },
                                {
                                  path: 'rollback',
                                  action: async (...args) => (await import('./routes/git-actions')).gitRollbackChangesAction(...args),
                                },
                                {
                                  path: 'repo',
                                  loader: async (...args) => (await import('./routes/git-actions')).gitRepoLoader(...args),
                                },
                                {
                                  path: 'update',
                                  action: async (...args) => (await import('./routes/git-actions')).updateGitRepoAction(...args),
                                },
                                {
                                  path: 'reset',
                                  action: async (...args) => (await import('./routes/git-actions')).resetGitRepoAction(...args),
                                },
                                {
                                  path: 'pull',
                                  action: async (...args) => (await import('./routes/git-actions')).pullFromGitRemoteAction(...args),
                                },
                                {
                                  path: 'push',
                                  action: async (...args) => (await import('./routes/git-actions')).pushToGitRemoteAction(...args),
                                },
                              ],
                            },
                          ],
                        },
                        {
                          path: 'new',
                          action: async (...args) =>
                            (await import('./routes/actions')).createNewWorkspaceAction(
                              ...args
                            ),
                        },
                        {
                          path: 'delete',
                          action: async (...args) =>
                            (await import('./routes/actions')).deleteWorkspaceAction(
                              ...args
                            ),
                        },
                        {
                          path: 'update',
                          action: async (...args) =>
                            (await import('./routes/actions')).updateWorkspaceAction(
                              ...args
                            ),
                        },
                      ],
                    },
                    {
                      path: 'new',
                      action: async (...args) =>
                        (await import('./routes/actions')).createNewProjectAction(
                          ...args
                        ),
                    },
                    {
                      path: ':projectId/remote-collections',
                      loader: async (...args) =>
                        (
                          await import('./routes/remote-collections')
                        ).remoteCollectionsLoader(...args),
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
      ],
    },
  ],
  {
    initialEntries: [locationHistoryEntry],
  }
);

// Store the last location in local storage
router.subscribe(({ location }) => {
  const match = matchPath(
    {
      path: '/organization/:organizationId',
      end: false,
    },
    location.pathname
  );

  localStorage.setItem('locationHistoryEntry', location.pathname);
  match?.params.organizationId && localStorage.setItem(`locationHistoryEntry:${match?.params.organizationId}`, location.pathname);
});

function updateReduxNavigationState(store: Store, pathname: string) {
  let currentActivity;
  const isActivityHome = matchPath(
    {
      path: '/organization/:organizationId/project/:projectId',
      end: true,
    },
    pathname
  );

  const isActivityDebug = matchPath(
    {
      path: `/organization/:organizationId/project/:projectId/workspace/:workspaceId/${ACTIVITY_DEBUG}`,
      end: false,
    },
    pathname
  );

  const isActivityDesign = matchPath(
    {
      path: `/organization/:organizationId/project/:projectId/workspace/:workspaceId/${ACTIVITY_SPEC}`,
      end: false,
    },
    pathname
  );

  const isActivityTest = matchPath(
    {
      path: '/organization/:organizationId/project/:projectId/workspace/:workspaceId/test',
      end: false,
    },
    pathname
  );

  if (isActivityDebug) {
    currentActivity = ACTIVITY_DEBUG;
    store.dispatch(
      setActiveProject(isActivityDebug?.params.projectId || '')
    );
    store.dispatch(
      setActiveWorkspace(isActivityDebug?.params.workspaceId || '')
    );
  } else if (isActivityDesign) {
    currentActivity = ACTIVITY_SPEC;
    store.dispatch(
      setActiveProject(isActivityDesign?.params.projectId || '')
    );
    store.dispatch(
      setActiveWorkspace(isActivityDesign?.params.workspaceId || '')
    );
  } else if (isActivityTest) {
    currentActivity = ACTIVITY_UNIT_TEST;
    store.dispatch(
      setActiveProject(isActivityTest?.params.projectId || '')
    );
    store.dispatch(
      setActiveWorkspace(isActivityTest?.params.workspaceId || '')
    );
  } else {
    currentActivity = ACTIVITY_HOME;
    store.dispatch(
      setActiveProject(isActivityHome?.params.projectId || '')
    );
  }

  return currentActivity;
}

async function renderApp() {
  await database.initClient();
  await models.project.seed();

  await initPlugins();

  const settings = await models.settings.getOrCreate();

  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }

  await applyColorScheme(settings);

  // Create Redux store
  const store = await initStore();
  // Synchronizes the Redux store with the router history
  // @HACK: This is temporary until we completely remove navigation through Redux
  const synchronizeRouterState = () => {
    let currentPathname = router.state.location.pathname;
    updateReduxNavigationState(store, router.state.location.pathname);
    router.subscribe(({ location }) => {
      if (location.pathname !== currentPathname) {
        currentPathname = location.pathname;
        updateReduxNavigationState(store, location.pathname);
      }
    });
  };

  synchronizeRouterState();

  const root = document.getElementById('root');

  invariant(root, 'Could not find root element');

  ReactDOM.createRoot(root).render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
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
