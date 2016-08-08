import React from 'react';
import {render} from 'react-dom'
import {Provider} from 'react-redux'
import {Tabs} from 'react-tabs'

import createStore from './redux/create';
import App from './containers/App';

// PERFORMANCE DEBUGGING STUFF
// import * as Perf from 'react-addons-perf';
// setTimeout(() => {
//   Perf.start();
//   console.log('started');
// }, 1000 * 5);
// setTimeout(() => {
//   Perf.stop();
//   console.log('stopped');
//   Perf.printWasted(Perf.getLastMeasurements())
// }, 1000 * 10);

// Global CSS
import './css/lib/fontawesome/css/font-awesome.css'
import './css/lib/fonts/open-sans.css'
import './css/index.scss'
import './css/lib/chrome/platform_app.css'
import {initStore} from './redux/initstore';
import {initDB} from './database';
import {getAppVersion} from './lib/appInfo';
import {initAnalytics} from './lib/analytics';

// Don't inject component styles (use our own)
Tabs.setUseDefaultStyles(false);

export const store = createStore();

console.log(`-- Loading App v${getAppVersion()} --`);

initDB()
  .then(() => initStore(store.dispatch))
  .then(() => initAnalytics()) // Must be after because we don't want to track the initial stuff
  .then(() => {
    console.log('-- Rendering App --');
    render(
      <Provider store={store}><App /></Provider>,
      document.getElementById('root')
    );
  });
