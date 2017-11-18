import * as React from 'react';
import ReactDOM from 'react-dom';
import {AppContainer} from 'react-hot-loader';
import {Provider} from 'react-redux';
import {DragDropContext} from 'react-dnd';
import App from './containers/app';
import * as models from '../models';
import * as db from '../common/database';
import {initClient as initDB} from '../common/database';
import {init as initStore} from './redux/modules';
import {init as initSync} from '../sync';
import {init as initPlugins} from '../plugins';
import DNDBackend from './dnd-backend';
import './css/index.less';
import {isDevelopment} from '../common/constants';
import {trackEvent, trackPageView} from '../common/analytics';

(async function () {
  await initDB();

  // Create Redux store
  const store = await initStore();

  const context = DragDropContext(DNDBackend);
  const DndComponent = context(App);
  const render = Component => {
    ReactDOM.render(
      <AppContainer>
        <Provider store={store}>
          <Component/>
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
  process.nextTick(initPlugins);
})();

// Export some useful things for dev
if (isDevelopment()) {
  window.models = models;
  window.db = db;
}

// Catch uncaught errors and report them
if (window && !isDevelopment()) {
  window.addEventListener('error', e => {
    trackEvent('Error', 'Uncaught Error');
    console.error('Uncaught Error', e);
  });

  window.addEventListener('unhandledRejection', e => {
    trackEvent('Error', 'Uncaught Promise');
    console.error('Unhandled Promise', e);
  });
}

// Track the page view
trackPageView();
