import React from 'react';
import {render} from 'react-dom';
import {Provider} from 'react-redux';
import {Tabs} from 'react-tabs';
import App from './containers/App';
import {init as initStore} from './redux/modules';
import {init as initDB} from '../common/database';
import {init as initSync} from '../sync';
import {init as initAnalytics} from '../analytics';
import {types as modelTypes} from '../models';
import './css/index.less';
import {getAccountId} from '../sync/session';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

(async function () {

  await initDB(modelTypes());
  await initAnalytics(getAccountId());

  // Create Redux store
  const store = await initStore();

  // Actually render the app
  render(
    <Provider store={store}><App /></Provider>,
    document.getElementById('root')
  );

  // Do things that can wait
  process.nextTick(initSync);
})();

