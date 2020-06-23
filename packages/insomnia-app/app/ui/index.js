import * as React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import App from './containers/app';
import * as models from '../models';
import * as db from '../common/database';
import { init as initStore } from './redux/modules';
import * as legacySync from '../sync-legacy';
import { init as initPlugins } from '../plugins';
import './css/index.less';
import { getAppId, getAppLongName, isDevelopment } from '../common/constants';
import { setFont, setTheme } from '../plugins/misc';
import { AppContainer } from 'react-hot-loader';
import { DragDropContext } from 'react-dnd';
import DNDBackend from './dnd-backend';
import { trackEvent } from '../common/analytics';
import { APP_ID_DESIGNER, APP_ID_INSOMNIA } from '../../config';

// Handy little helper
document.body.setAttribute('data-platform', process.platform);
document.title = getAppLongName();

(async function() {
  await db.initClient();
  await initPlugins();

  const settings = await models.settings.getOrCreate();
  await setTheme(settings.theme);
  await setFont(settings);

  // Create Redux store
  const store = await initStore();

  const context = DragDropContext(DNDBackend);
  const render = Component => {
    const DnDComponent = context(Component);
    ReactDOM.render(
      <AppContainer>
        <Provider store={store}>
          <DnDComponent />
        </Provider>
      </AppContainer>,
      document.getElementById('root'),
    );
  };

  render(App);

  // Hot Module Replacement API
  if (module.hot) {
    // module.hot.accept('./containers/app', () => {
    //   render(App);
    // });
  }

  const appId = getAppId();

  // Legacy sync not part of Designer
  if (appId === APP_ID_DESIGNER) {
    legacySync.disableForSession();
  } else if (appId === APP_ID_INSOMNIA) {
    // Do things that can wait
    const { enableSyncBeta } = await models.settings.getOrCreate();
    if (enableSyncBeta) {
      console.log('[app] Enabling sync beta');
      legacySync.disableForSession();
    } else {
      process.nextTick(legacySync.init);
    }
  }
})();

// Export some useful things for dev
if (isDevelopment()) {
  window.models = models;
  window.db = db;
}

// Catch uncaught errors and report them
if (window && !isDevelopment()) {
  window.addEventListener('error', e => {
    console.error('Uncaught Error', e);
    trackEvent('Error', 'Uncaught Error');
  });

  window.addEventListener('unhandledRejection', e => {
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
