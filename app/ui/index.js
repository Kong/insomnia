import React from 'react';
import ReactDOM from 'react-dom';
import {AppContainer} from 'react-hot-loader';
import {Provider} from 'react-redux';
import {Tabs} from 'react-tabs';
import {DragDropContext} from 'react-dnd';
import App from './containers/app';
import {init as initStore} from './redux/modules';
import {init as initDB} from '../common/database';
import {init as initSync} from '../sync';
import {init as initAnalytics} from '../analytics';
import {init as initPlugins} from '../plugins';
import {types as modelTypes} from '../models';
import {getAccountId} from '../sync/session';
import DNDBackend from './dnd-backend';
import './css/index.less';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

(async function () {
  await initDB(modelTypes());
  await initAnalytics(getAccountId());
  await initPlugins();

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
})();
