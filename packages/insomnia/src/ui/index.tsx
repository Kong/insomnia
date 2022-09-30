// eslint-disable-next-line simple-import-sort/imports
import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import './rendererListeners';
import { getProductName, isDevelopment } from '../common/constants';
import { database } from '../common/database';
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
  await database.initClient();

  await initPlugins();

  const settings = await models.settings.getOrCreate();

  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }

  await applyColorScheme(settings);

  // Create Redux store
  const store = await initStore();

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
})();

// Export some useful things for dev
if (isDevelopment()) {
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.models = models;
  // @ts-expect-error -- TSCONVERSION needs window augmentation
  window.db = database;
}
