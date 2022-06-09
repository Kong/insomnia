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
// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getProductName();

(async function() {
  await db.initClient();

  await initPlugins();

  const settings = await models.settings.getOrCreate();

  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }

  await applyColorScheme(settings);

  // Create Redux store
  const store = await initStore();

  const render = App => {
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
})();

// Export some useful things for dev
if (isDevelopment()) {
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.models = models;
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.db = db;
}

function showUpdateNotification() {
  console.log('[app] Update Available');
  // eslint-disable-next-line no-new
  new window.Notification('Insomnia Update Ready', {
    body: 'Relaunch the app for it to take effect',
    silent: true,
    // @ts-expect-error -- TSCONVERSION
    sticky: true,
  });
}

ipcRenderer.on('update-available', () => {
  // Give it a few seconds before showing this. Sometimes, when
  // you relaunch too soon it doesn't work the first time.
  setTimeout(showUpdateNotification, 1000 * 10);
});
