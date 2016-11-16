import React from 'react';
import {render} from 'react-dom';
import {Provider} from 'react-redux';
import {Tabs} from 'react-tabs';
import createStore from './redux/create';
import App from './containers/App';
import './css/lib/fontawesome/css/font-awesome.css';
import './css/lib/fonts/open-sans.css';
import './css/index.less';
import './css/lib/chrome/platform_app.css';
import {init as initStore} from './redux/modules';
import {init as initDB} from '../common/database';
import {init as initSync} from '../sync';
import {init as initAnalytics} from '../analytics';
import * as session from '../sync/session';
import * as models from '../models';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

export const store = createStore();
const accountId = session.getAccountId();

(async function () {
  await initDB(models.types());
  await initSync();
  await initStore(store.dispatch);
  await initAnalytics(accountId);
  render(
    <Provider store={store}><App /></Provider>,
    document.getElementById('root')
  );
})();
