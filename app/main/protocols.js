import electron from 'electron';
import {isDevelopment} from '../common/constants';

const {app, dialog} = electron;

const PROTOCOL_INSOMNIA = isDevelopment() ? 'insomnia' : 'insomniadev';
const PROTOCOLS = [PROTOCOL_INSOMNIA];

export function init () {
  // Register the protocol to the app if it's not already
  _registerProtocols();

  // Check for launch with protocol argument
  _checkLaunchArgs();

  // Set listener to listen for URL opens
  _addProtocolListener();
}

function _registerProtocols () {
  for (const protocol of PROTOCOLS) {
    if (!app.isDefaultProtocolClient(protocol)) {
      app.setAsDefaultProtocolClient(protocol);
    }
  }
}

function _checkLaunchArgs () {
  if (process.argv.length > 1) {
    _handleProtocolTrigger(process.argv[1]);
    dialog.showMessageBox({
      type: 'info',
      title: 'Launched with',
      message: JSON.stringify(process.argv, null, '\t')
    });
  }
}

function _addProtocolListener () {
  // This gets called when an import is clicked when a registered
  // protocol is clicked when the app is already open
  app.on('open-url', (...args) => {
    _handleProtocolTrigger(args[1]);
  });
}

function _handleProtocolTrigger (uri) {
  if (!uri) {
    return;
  }

  if (uri.indexOf(`${PROTOCOL_INSOMNIA}://`) === 0) {
    console.log('PROTOCOL TRIGGER', uri);
    dialog.showMessageBox({type: 'info', title: 'Opened URL', message: uri});
  }
}
