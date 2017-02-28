import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from 'react-redux';
import {Tabs} from 'react-tabs';
import App from './containers/App';
import './css/index.less';
import {init as initStore} from './redux/modules';
import {init as initDB} from '../common/database';
import {init as initSync} from '../sync';
import {init as initAnalytics} from '../analytics';
import {init as initPlugins} from '../plugin';
import {types as modelTypes} from '../models';
import {getAccountId} from '../sync/session';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

(async function () {

  await initDB(modelTypes());
  await initAnalytics(getAccountId());
  await initPlugins();

  // Create Redux store
  const store = await initStore();

  // Actually render the app
  ReactDOM.render(
    <Provider store={store}><App /></Provider>,
    document.getElementById('root')
  );

  // Do things that can wait
  process.nextTick(initSync);
})();

