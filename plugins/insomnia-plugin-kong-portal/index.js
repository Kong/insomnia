import React from 'react';
import ReactDOM from 'react-dom';
import DeployToPortal from './src/deploy-to-portal';

export const documentActions = [
  {
    label: 'Deploy to Dev Portal',
    hideAfterClick: true,
    action(context, spec) {
      const root = document.createElement('div');
      ReactDOM.render(
        <DeployToPortal
          spec={spec}
          store={context.store}
          axios={context.__private.axios}
          trackEvent={context.__private.analytics.trackEvent}
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
