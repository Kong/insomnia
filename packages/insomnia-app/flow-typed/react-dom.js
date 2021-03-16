// @flow

import * as React from 'react';

declare module 'react-dom' {
  declare module.exports: {
    findDOMNode: React.Node => HTMLElement,
    render: (React.Node, HTMLElement) => void,
    createPortal: (React.Node, HTMLElement) => React.Node,
  };
}
