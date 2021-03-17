import { hot } from 'react-hot-loader';
import * as React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import App from './containers/app';
import * as models from '../models';
import * as db from '../common/database';
import { init as initStore } from './redux/modules';
import { init as initPlugins } from '../plugins';
import './css/index.less';
import { getAppLongName, isDevelopment } from '../common/constants';
import { setFont, applyColorScheme } from '../plugins/misc';
import { trackEvent } from '../common/analytics';
import * as styledComponents from 'styled-components';
import { initNewOAuthSession } from '../network/o-auth-2/misc';
import { initializeLogging } from '../common/log';

initializeLogging();

// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getAppLongName();

(async function() {
  await db.initClient();
  await initPlugins();

  const settings = await models.settings.getOrCreate();
  if (settings.clearOAuth2SessionOnRestart) {
    initNewOAuthSession();
  }
  await applyColorScheme(settings);
  await setFont(settings);

  // Create Redux store
  const store = await initStore();

  const render = App => {
    const TheHottestApp = hot(module)(App);
    ReactDOM.render(
      <Provider store={store}>
        <TheHottestApp />
      </Provider>,
      document.getElementById('root'),
    );
  };

  render(App);
})();

// Export some useful things for dev
if (isDevelopment()) {
  window.models = models;
  window.db = db;
}

// Styled components is added to the window object here, for plugins to use.
// UI plugins built with webpack (such as insomnia-plugin-kong-portal) define styled-components as an external resolved
// from the window object. This is to ensure there is only one instance of styled-components on the page.
// Because styled-components are loaded at runtime, they don't have direct access to modules in the electron bundle
window['styled-components'] = styledComponents;

// Catch uncaught errors and report them
if (window && !isDevelopment()) {
  window.addEventListener('error', e => {
    console.error('Uncaught Error', e);
    trackEvent('Error', 'Uncaught Error');
  });

  window.addEventListener('unhandledrejection', e => {
    console.error('Unhandled Promise', e);
    trackEvent('Error', 'Uncaught Promise');
  });
}

function showUpdateNotification() {
  console.log('[app] Update Available');

  // eslint-disable-next-line no-new
  new window.Notification('Insomnia Update Ready', {
    body: 'Relaunch the app for it to take effect',
    silent: true,
    sticky: true,
  });
}

const { ipcRenderer } = require('electron');
ipcRenderer.on('update-available', () => {
  // Give it a few seconds before showing this. Sometimes, when
  // you relaunch too soon it doesn't work the first time.
  setTimeout(showUpdateNotification, 1000 * 10);
});
