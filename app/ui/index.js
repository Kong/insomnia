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
import {initStore} from './redux/initstore';
import {initDB} from '../common/database';
import {initSync} from '../sync';
import {getAppVersion} from '../common/constants';
import {initAnalytics} from '../analytics';
import * as session from '../sync/session';
import * as models from '../models';

// Global CSS

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

export const store = createStore();

console.log(`-- Loading App v${getAppVersion()} --`);

const accountId = session.getAccountId();

(async function () {
  await initDB(models.types());
  await initSync();
  await initStore(store.dispatch);
  await initAnalytics(accountId);
  console.log('-- Rendering App --');
  render(
    <Provider store={store}><App /></Provider>,
    document.getElementById('root')
  );
})();
