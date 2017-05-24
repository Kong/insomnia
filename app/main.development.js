import needsRestart from 'electron-squirrel-startup';
import electron from 'electron';
import {isDevelopment, isMac} from './common/constants';
import * as errorHandling from './main/error-handling';
import * as updates from './main/updates';
import * as windowUtils from './main/window-utils';

// Handle potential auto-update
if (needsRestart) {
  process.exit(0);
}

// Initialize some things
errorHandling.init();
updates.init();
windowUtils.init();

function addUrlToOpen (e, url) {
  e.preventDefault();
  args.push(url);
}

const {app, ipcMain} = electron;

const args = process.argv.slice(1);

// Set as default protocol
app.setAsDefaultProtocolClient(`insomnia${isDevelopment() ? 'dev' : ''}`);

app.on('open-url', addUrlToOpen);

// Enable this for CSS grid layout :)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

// Quit when all windows are closed (except on Mac).
app.on('window-all-closed', () => {
  if (!isMac()) {
    app.quit();
  }
});

// Mac-only, when the user clicks the doc icon
app.on('activate', (e, hasVisibleWindows) => {
  // Create a new window when clicking the doc icon if there isn't one open
  if (!hasVisibleWindows) {
    try {
      windowUtils.createWindow();
    } catch (e) {
      // This might happen if 'ready' hasn't fired yet. So we're just going
      // to silence these errors.
      console.log('-- App not ready to "activate" yet --');
    }
  }
});

// When the app is first launched
app.on('ready', () => {
  app.removeListener('open-url', addUrlToOpen);
  const window = windowUtils.createWindow();

  // Handle URLs sent via command line args
  ipcMain.once('app-ready', () => {
    args.length && window.send('run-command', args[0]);
  });

  // Called when second instance launched with args (Windows)
  app.makeSingleInstance(args => {
    args.length && window.send('run-command', args[0]);
  });

  // Handle URLs when app already open
  app.addListener('open-url', (e, url) => {
    window.send('run-command', url);
    // Apparently a timeout is needed because Chrome steals back focus immediately
    // after opening the URL.
    setTimeout(() => {
      window.focus();
    }, 100);
  });
});
