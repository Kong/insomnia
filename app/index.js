import React from 'react'
import {render} from 'react-dom'
import {Provider} from 'react-redux'
import configureStore from './stores/configureStore'
import AppWrapper from './containers/AppWrapper'


// Global CSS
import './css/index.scss'
import './css/lib/chrome/platform_app.css'
import './css/lib/fontawesome/css/font-awesome.css'

const store = configureStore();

render(
  <Provider store={store}><AppWrapper /></Provider>,
  document.getElementById('root')
);
