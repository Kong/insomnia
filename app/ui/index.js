import React from 'react';
import ReactDOM from 'react-dom';
import {AppContainer} from 'react-hot-loader';
import {Provider} from 'react-redux';
import {Tabs} from 'react-tabs';
import App from './containers/app';
import './css/index.less';
import {init as initStore} from './redux/modules';
import {init as initDB} from '../common/database';
import {init as initSync} from '../sync';
import {init as initAnalytics} from '../analytics';
import {types as modelTypes} from '../models';
import {getAccountId} from '../sync/session';
import HTML5Backend from 'react-dnd-html5-backend';
import {DragDropContext} from 'react-dnd';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

(async function () {
  await initDB(modelTypes());
  await initAnalytics(getAccountId());

  // Create Redux store
  const store = await initStore();

  const context = DragDropContext(HTML5Backend);
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
