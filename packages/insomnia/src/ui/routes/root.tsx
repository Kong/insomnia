import '../css/styles.css';

import React from 'react';
import {
  Outlet,
} from 'react-router-dom';

import { ErrorBoundary } from '../components/error-boundary';

const Root = () => {
  return (
    <ErrorBoundary>
      <div className="app">
        <Outlet />
      </div>
    </ErrorBoundary>
  );
};

export default Root;
