import axios from 'axios';
import React from 'react';
import ReactDOM from 'react-dom';

import { DeployToPortal } from './deploy-to-portal';

// This is a temporary shim until insomnia-app exports plugin types that plugin authors can use
export interface Spec {
  contents: Object;
  rawContents: string;
  format: string;
  formatVersion: string;
}

// This is a temporary shim until insomnia-app exports plugin types that plugin authors can use
export interface Context {
  store: {
    hasItem: (key: string) => Promise<boolean>;
    setItem: (key: string, value: string) => Promise<void>;
    getItem: (key: string) => Promise<string | null>;
  };
  __private: {
    axios: typeof axios;
    analytics: {
      trackSegmentEvent: (event: string, properties?: Record<string, any>) => any;
    };
  };
  app: {
    dialog: (message: string, root: HTMLElement, config: any) => void;
  };
}

export const documentActions = [
  {
    label: 'Deploy to Dev Portal',
    hideAfterClick: true,
    action(context: Context, spec: Spec) {
      const root = document.createElement('div');
      ReactDOM.render(
        <DeployToPortal
          spec={spec}
          store={context.store}
          axios={context.__private.axios}
          trackSegmentEvent={context.__private.analytics.trackSegmentEvent}
        />,
        root,
      );

      context.app.dialog('Deploy to Dev Portal', root, {
        skinny: true,
        onHide() {
          ReactDOM.unmountComponentAtNode(root);
        },
      });
    },
  },
];
