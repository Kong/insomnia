import React from 'react'
import {render} from 'react-dom'
import {Provider} from 'react-redux'
import configureStore from './stores/configureStore'
import AppWrapper from './containers/App'


// Global CSS
import './css/index.scss'
import './css/lib/chrome/platform_app.css'
import './css/lib/fontawesome/css/font-awesome.css'
import * as GlobalActions from "./actions/global";

const store = configureStore();

// Dispatch the initial load of data
console.log('Init Insomnia');
store.dispatch(GlobalActions.restoreState());

render(
  <Provider store={store}><AppWrapper /></Provider>,
  document.getElementById('root')
);
