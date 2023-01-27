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
import { strings } from '../common/strings';
import * as models from '../models';
import { DEFAULT_ORGANIZATION_ID } from '../models/organization';
import { DEFAULT_PROJECT_ID, isRemoteProject } from '../models/project';
import { initNewOAuthSession } from '../network/o-auth-2/misc';
import { init as initPlugins } from '../plugins';
import { applyColorScheme } from '../plugins/misc';
import { invariant } from '../utils/invariant';
import { AppLoadingIndicator } from './components/app-loading-indicator';
import { init as initStore, RootState } from './redux/modules';
import {
  setActiveActivity,
  setActiveProject,
  setActiveWorkspace,
} from './redux/modules/global';
import { selectActiveProject } from './redux/selectors';
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
                                  path: 'changes',
                                  loader: async (...args) => (await import('./routes/git-actions')).gitChangesLoader(...args),
                                },
                                {
                                  path: 'commit',
                                  action: async (...args) => (await import('./routes/git-actions')).commitToGitRepoAction(...args),
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
  localStorage.setItem('locationHistoryEntry', location.pathname);
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
    store.dispatch(setActiveActivity(ACTIVITY_DEBUG));
  } else if (isActivityDesign) {
    currentActivity = ACTIVITY_SPEC;
    store.dispatch(
      setActiveProject(isActivityDesign?.params.projectId || '')
    );
    store.dispatch(
      setActiveWorkspace(isActivityDesign?.params.workspaceId || '')
    );
    store.dispatch(setActiveActivity(ACTIVITY_SPEC));
  } else if (isActivityTest) {
    currentActivity = ACTIVITY_UNIT_TEST;
    store.dispatch(
      setActiveProject(isActivityTest?.params.projectId || '')
    );
    store.dispatch(
      setActiveWorkspace(isActivityTest?.params.workspaceId || '')
    );
    store.dispatch(setActiveActivity(ACTIVITY_UNIT_TEST));
  } else {
    currentActivity = ACTIVITY_HOME;
    store.dispatch(
      setActiveProject(isActivityHome?.params.projectId || '')
    );
    store.dispatch(setActiveActivity(ACTIVITY_HOME));
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
    let currentActivity = (store.getState() as RootState).global.activeActivity;
    let currentPathname = router.state.location.pathname;

    currentActivity = updateReduxNavigationState(store, router.state.location.pathname);

    router.subscribe(({ location }) => {
      if (location.pathname !== currentPathname) {
        currentPathname = location.pathname;
        currentActivity = updateReduxNavigationState(store, location.pathname);
      }
    });

    store.subscribe(() => {
      const state = store.getState() as RootState;
      const activity = state.global.activeActivity;

      const activeProject = selectActiveProject(state);
      const organizationId = activeProject && isRemoteProject(activeProject) ? activeProject._id : DEFAULT_ORGANIZATION_ID;

      if (activity !== currentActivity) {
        currentActivity = activity;
        const activeProjectId = activeProject ? activeProject._id : DEFAULT_PROJECT_ID;
        if (activity === ACTIVITY_HOME) {
          router.navigate(`/organization/${organizationId}/project/${activeProject._id}`);
        } else if (activity === ACTIVITY_DEBUG) {
          router.navigate(
            `/organization/${organizationId}/project/${activeProjectId}/workspace/${state.global.activeWorkspaceId}/${ACTIVITY_DEBUG}`
          );
        } else if (activity === ACTIVITY_SPEC) {
          router.navigate(
            `/organization/${organizationId}/project/${activeProjectId}/workspace/${state.global.activeWorkspaceId}/${ACTIVITY_SPEC}`
          );
        } else if (activity === ACTIVITY_UNIT_TEST) {
          router.navigate(
            `/organization/${organizationId}/project/${state.global.activeProjectId}/workspace/${state.global.activeWorkspaceId}/test`
          );
        }
      }

    });
  };

  synchronizeRouterState();
  // Create an empty workspace with a request if the app is launched for the first time
  const stats = await models.stats.get();

  const isFirstLaunch = !(stats.launches > 1);

  if (isFirstLaunch) {
    const workspace = await models.workspace.create({
      scope: 'design',
      name: `New ${strings.document.singular}`,
      parentId: DEFAULT_PROJECT_ID,
    });

    const { _id: workspaceId } = workspace;

    // Create default env, cookie jar, and meta
    await models.environment.getOrCreateForParentId(workspace._id);
    await models.cookieJar.getOrCreateForParentId(workspace._id);
    await models.workspaceMeta.getOrCreateByParentId(workspace._id);

    const request = await models.request.create({ parentId: workspaceId });

    const unitTestSuite = await models.unitTestSuite.create({
      parentId: workspaceId,
      name: 'Example Test Suite',
    });

    await models.workspaceMeta.updateByParentId(workspaceId, {
      activeRequestId: request._id,
      activeActivity: ACTIVITY_DEBUG,
      activeUnitTestSuiteId: unitTestSuite._id,
    });

    router.navigate(`/organization/${DEFAULT_ORGANIZATION_ID}/project/${DEFAULT_PROJECT_ID}/workspace/${workspaceId}/${ACTIVITY_DEBUG}`);
  }

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
