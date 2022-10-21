// eslint-disable-next-line simple-import-sort/imports
import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import './rendererListeners';
import { ACTIVITY_DEBUG, ACTIVITY_HOME, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST, getProductName, isDevelopment } from '../common/constants';
import { database } from '../common/database';
import { initializeLogging } from '../common/log';
import * as models from '../models';
import { initNewOAuthSession } from '../network/o-auth-2/misc';
import { init as initPlugins } from '../plugins';
import { applyColorScheme } from '../plugins/misc';
import { init as initStore } from './redux/modules';
import { initializeSentry } from './sentry';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

import Root from './routes/root';
import './css/index.less'; // this import must come after `Root`.
import { AppLoadingIndicator } from './components/app-loading-indicator';
const Project = lazy(() => import('./routes/project'));
const UnitTest = lazy(() => import('./routes/unit-test'));
const Debug = lazy(() => import('./routes/debug'));
const Design = lazy(() => import('./routes/design'));

initializeSentry();
initializeLogging();
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

const router = createMemoryRouter(
  // @TODO - Investigate file based routing to generate these routes:
  [
    {
      path: '/',
      element: <Root />,
      errorElement: <div>Error</div>,
      children: [
        {
          path: ACTIVITY_HOME,
          element: (
            <Suspense fallback={<AppLoadingIndicator />}>
              <Project />
            </Suspense>
          ),
        },
        {
          path: ACTIVITY_DEBUG,
          element: (
            <Suspense fallback={<AppLoadingIndicator />}>
              <Debug />
            </Suspense>
          ),
        },
        {
          path: ACTIVITY_SPEC,
          element: (
            <Suspense fallback={<AppLoadingIndicator />}>
              <Design />
            </Suspense>
          ),
        },
        {
          path: ACTIVITY_UNIT_TEST,
          element: (
            <Suspense fallback={<AppLoadingIndicator />}>
              <UnitTest />
            </Suspense>
          ),
        },
      ],
    },
  ]
);

async function renderApp() {
  await database.initClient();

  await initPlugins();

  const settings = await models.settings.getOrCreate();

  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }

  await applyColorScheme(settings);

  // Create Redux store
  const store = await initStore();

  const root = document.getElementById('root');

  if (!root) {
    throw new Error('Could not find root element');
  }

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
