import React from 'react';
import ReactDOM from 'react-dom';
import DeployToPortal from './src/deploy-to-portal';

export const documentActions = [{
  label: 'Do something cool!!!',
  hideAfterClick: true,
  action(context, specs) {
    const root = document.createElement('div');
    ReactDOM.render(<DeployToPortal specs={specs} />, root);

    context.app.alert('So cool!');
    // context.app.dialog('Deploy to Portal', root, {
    //   skinny: true,
    //   onHide() {
    //     ReactDOM.unmountComponentAtNode(root);
    //   },
    // });
  },
}];
