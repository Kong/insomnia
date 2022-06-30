const { PerformanceObserver, performance } = window;

const obs = new PerformanceObserver(items => {
  console.log('performance-observer', items.getEntries());
});

obs.observe({
  entryTypes: ['measure'],
});

// eslint-disable-next-line simple-import-sort/imports
import { ipcRenderer } from 'electron';
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

import { getProductName, isDevelopment } from '../common/constants';
import { database as db } from '../common/database';
import { initializeLogging } from '../common/log';
import * as models from '../models';
import { initNewOAuthSession } from '../network/o-auth-2/misc';
import { init as initPlugins } from '../plugins';
import { applyColorScheme } from '../plugins/misc';
import App from './containers/app';
import { init as initStore } from './redux/modules';
import { initializeSentry } from './sentry';
import { MemoryRouter as Router } from 'react-router-dom';
import './css/index.less'; // this import must come after `App`.  the reason is not yet known.

initializeSentry();
initializeLogging();
export const FirstPaint = () => {
  return <button>for testing without rendering</button>;
};
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

(async function() {
  await db.initClient();

  performance.mark('willInitPlugins');
  await initPlugins();
  performance.mark('didInitPlugins');

  const settings = await models.settings.getOrCreate();

  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }

  await applyColorScheme(settings);

  performance.mark('willInitReduxStore');
  const store = await initStore();
  performance.mark('didInitReduxStore');

  performance.mark('willInitReactApp');
  const render = (App: React.ComponentType<any>) => {
    ReactDOM.render(
      <Provider store={store}>
        <Router>
          <App />
        </Router>
      </Provider>,
      document.getElementById('root'),
    );
  };
  render(App);
  performance.mark('didInitReactApp');

  performance.measure('initPlugins', 'willInitPlugins', 'didInitPlugins');
  performance.measure('initReduxStore', 'willInitReduxStore', 'didInitReduxStore');
  performance.measure('initReactApp', 'willInitReactApp', 'didInitReactApp');

  // performance.clearMarks();
})();

// Export some useful things for dev
if (isDevelopment()) {
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.models = models;
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.db = db;
}

ipcRenderer.on('update-available', () => {
  // Give it a few seconds before showing this. Sometimes, when
  // you relaunch too soon it doesn't work the first time.
  setTimeout(() => {
    console.log('[app] Update Available');
    // eslint-disable-next-line no-new
    new window.Notification('Insomnia Update Ready', {
      body: 'Relaunch the app for it to take effect',
      silent: true,
      // @ts-expect-error -- TSCONVERSION
      sticky: true,
    });
  }, 1000 * 10);
});
