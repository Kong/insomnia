import axios from 'axios';
import type React from 'react';
import type ReactDOM from 'react-dom';

import { getDeployToPortalComponent } from './deploy-to-portal';

// This is a temporary shim until insomnia exports plugin types that plugin authors can use
export interface Spec {
  contents: Object;
  rawContents: string;
  format: string;
  formatVersion: string;
}

// This is a temporary shim until insomnia exports plugin types that plugin authors can use
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
    loadRendererModules: () => Promise<{
      ReactDOM: typeof ReactDOM;
      React: typeof React;
    }>;
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
      const { analytics, axios, loadRendererModules } = context.__private;
      loadRendererModules().then(({ React, ReactDOM }) => {
        const { DeployToPortal } = getDeployToPortalComponent({ React });

        ReactDOM.render(
          <DeployToPortal
            spec={spec}
            store={context.store}
            axios={axios}
            trackSegmentEvent={analytics.trackSegmentEvent}
          />,
          root,
        );

        context.app.dialog('Deploy to Dev Portal', root, {
          skinny: true,
          onHide() {
            ReactDOM.unmountComponentAtNode(root);
          },
        });
      });
    },
  },
];
