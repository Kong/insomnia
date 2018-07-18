import * as React from 'react';
import ReactDOM from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import { Provider } from 'react-redux';
import { DragDropContext } from 'react-dnd';
import App from './containers/app';
import * as models from '../models';
import * as db from '../common/database';
import { init as initStore } from './redux/modules';
import { init as initSync } from '../sync';
import { init as initPlugins } from '../plugins';
import DNDBackend from './dnd-backend';
import './css/index.less';
import { isDevelopment } from '../common/constants';
import { setTheme } from '../plugins/misc';

// Handy little helper
document.body.setAttribute('data-platform', process.platform);

(async function() {
  await db.initClient();
  await initPlugins();

  const settings = await models.settings.getOrCreate();
  await setTheme(settings.theme);

  // Create Redux store
  const store = await initStore();

  const context = DragDropContext(DNDBackend);
  const DndComponent = context(App);
  const render = Component => {
    ReactDOM.render(
      <AppContainer>
        <Provider store={store}>
          <Component />
        </Provider>
      </AppContainer>,
      document.getElementById('root')
    );
  };

  render(DndComponent);

  // Hot Module Replacement API
  if (module.hot) {
    module.hot.accept('./containers/app', () => {
      render(DndComponent);
    });
  }

  // Do things that can wait
  process.nextTick(initSync);
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
  });

  window.addEventListener('unhandledRejection', e => {
    console.error('Unhandled Promise', e);
  });
}

function showUpdateNotification() {
  console.log('[app] Update Available');

  // eslint-disable-next-line no-new
  new window.Notification('Insomnia Update Ready', {
    body: 'Relaunch the app for it to take effect',
    silent: true,
    sticky: true
  });
}

const { ipcRenderer } = require('electron');
ipcRenderer.on('update-available', () => {
  // Give it a few seconds before showing this. Sometimes, when
  // you relaunch too soon it doesn't work the first time.
  setTimeout(showUpdateNotification, 1000 * 10);
});
