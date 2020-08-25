const onboarding = require('../modules/onboarding');
const client = require('../modules/client');
const home = require('../modules/home');

const Application = require('spectron').Application;
const electronPath = require('../../insomnia-app/node_modules/electron');
const path = require('path');

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    app = new Application({
      // Run installed app
      // path: '/Applications/Insomnia.app/Contents/MacOS/Insomnia',

      // Run after app-package - mac
      // path: path.join(__dirname, '../insomnia-app/dist/com.insomnia.designer/mac/Insomnia.app/Contents/MacOS/Insomnia'),

      // Run after app-package - Windows
      // path: path.join(__dirname, '../insomnia-app/dist/com.insomnia.designer/win-unpacked/Insomnia.exe'),

      // Run after app-build - mac, Windows, Linux
      path: electronPath,
      args: [path.join(__dirname, '../../insomnia-app/build/com.insomnia.designer')],

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

  it('can reset to and proceed through onboarding flow', async () => {
    await client.correctlyLaunched(app);
    await client.resetToOnboarding(app);

    await onboarding.welcomeMessageShown(app);
    await onboarding.clickDontShare(app);
    await onboarding.clickSkipImport(app);

    await home.documentListingShown(app);
  });
});
