const Application = require('spectron').Application;
// const fs = require('fs');
const electronPath = require('../../insomnia-app/node_modules/electron');
const path = require('path');
const debug = require('../modules/debug');
const client = require('../modules/client');

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    app = new Application({
      // Run installed app
      // path: '/Applications/Insomnia.app/Contents/MacOS/Insomnia',

      // Run after app-package - mac
      // path: path.join(__dirname, '../insomnia-app/dist/com.insomnia.app/mac/Insomnia.app/Contents/MacOS/Insomnia'),

      // Run after app-package - Windows
      // path: path.join(__dirname, '../insomnia-app/dist/com.insomnia.app/win-unpacked/Insomnia.exe'),

      // Run after app-build - mac, Windows, Linux
      path: electronPath,
      args: [path.join(__dirname, '../../insomnia-app/build/com.insomnia.app')],

      // Don't ask why, but don't remove chromeDriverArgs
      // https://github.com/electron-userland/spectron/issues/353#issuecomment-522846725
      chromeDriverArgs: ['remote-debugging-port=9222'],
    });
    await app.start().then(async () => {
      // Windows spawns two terminal windows when running spectron, and the only workaround
      // is to focus the window on start.
      // https://github.com/electron-userland/spectron/issues/60
      await app.browserWindow.focus();
      await app.browserWindow.setAlwaysOnTop(true);
    });
  });

  afterEach(async () => {
    if (app && app.isRunning()) {
      await app.stop();
    }
  });

  it('shows an initial window', async () => {
    await client.correctlyLaunched(app);
    await debug.workspaceDropdownExists(app);
  });

  it('creates and sends a request', async () => {
    await debug.workspaceDropdownExists(app);

    // Create a new request
    await app.client.$('.sidebar .dropdown .fa-plus-circle').then(e => e.click());

    await app.client
      .$('[aria-hidden=false]')
      .then(e => e.$('button*=New Request'))
      .then(e => e.click());

    // Wait for modal to open
    await app.client.waitUntilTextExists('.modal__header', 'New Request');

    // Set name and create request
    const input = await app.client.$('.modal input');
    await input.waitUntil(() => input.isFocused());
    const requestName = 'Request from test';
    await input.keys(requestName);

    await app.client
      .$('.modal .modal__footer')
      .then(e => e.$('button=Create'))
      .then(e => e.click());

    // Ensure first item is the one we created and is selected
    const requests = await app.client.$$('.sidebar__item');
    const firstRequest = requests[0];
    const firstRequestName = await firstRequest.$('span.editable').then(e => e.getText());
    const firstRequestClasses = await firstRequest.getAttribute('class');

    expect(firstRequestName).toBe(requestName);
    expect(firstRequestClasses).toContain('sidebar__item--active');

    // Type into url bar
    const urlEditor = await app.client.$('.urlbar .editor');
    await urlEditor.click();
    await urlEditor.keys('http://127.0.0.1:4010/pets/1');

    // Send request
    await app.client.$('.urlbar__send-btn').then(e => e.click());

    // Expect 200
    await app.client
      .$('.response-pane .pane__header .tag.bg-success')
      .then(e => e.getText())
      .then(e => expect(e).toBe('200 OK'));

    // await app.browserWindow.capturePage().then(function(imageBuffer) {
    //   fs.writeFileSync('page.png', imageBuffer);
    // });
  });
});
