import React from 'react'
import { render } from 'react-dom'
import { Provider } from 'react-redux'
import { loadTodos } from './actions/index';
import App from './containers/App'
import configureStore from './stores/configureStore'
import './css/index.scss'
import './css/lib/fontawesome/css/font-awesome.css'

const store = configureStore();

render(
    <Provider store={store}><App /></Provider>,
    document.getElementById('root')
);
