import React from 'react';
import {render} from 'react-dom'
import {Provider} from 'react-redux'
import {Tabs} from 'react-tabs'

import createStore from './redux/create';
import App from './containers/App';

// Global CSS
import './css/lib/fontawesome/css/font-awesome.css'
import './css/lib/fonts/open-sans.css'
import './css/index.less'
import './css/lib/chrome/platform_app.css'
import {initStore} from './redux/initstore';
import {initDB} from '../backend/database';
import {getAppVersion} from '../backend/appInfo';
import {initAnalytics} from '../backend/analytics';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

export const store = createStore();

console.log(`-- Loading App v${getAppVersion()} --`);

(async function () {
  await initDB();
  await initStore(store.dispatch);
  await initAnalytics();
  console.log('-- Rendering App --');
  render(
    <Provider store={store}><App /></Provider>,
    document.getElementById('root')
  );
})();
