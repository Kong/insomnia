import React from 'react';
import ReactDOM from 'react-dom';

import App from './components'

const root = document.querySelector('#react-root');
root && ReactDOM.render(<App path={window.location.pathname}/>, root);
