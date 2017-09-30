import * as React from 'react';
import ReactDOM from 'react-dom';
import {AppContainer} from 'react-hot-loader';
import {Provider} from 'react-redux';
import {DragDropContext} from 'react-dnd';
import App from './containers/app';
import * as models from '../models';
import {types as modelTypes} from '../models';
import {init as initStore} from './redux/modules';
import {init as initDB} from '../common/database';
import {init as initSync} from '../sync';
import {init as initAnalytics} from '../analytics';
import {init as initPlugins} from '../plugins';
import {getAccountId} from '../sync/session';
import DNDBackend from './dnd-backend';
import './css/index.less';
import {isDevelopment} from '../common/constants';

(async function () {
  await initDB(modelTypes());
  await initAnalytics(getAccountId());

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
}
