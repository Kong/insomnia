import { Application } from 'spectron';
import electronPath from '../../insomnia-app/node_modules/electron';
import path from 'path';
import * as debug from '../modules/debug';
import * as client from '../modules/client';
import os from 'os';

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    const userDataDir = path.join(os.tmpdir(), 'insomnia-smoke-test', `${Math.random()}`);

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
      env: { INSOMNIA_DATA_PATH: userDataDir },
    });
    await app.start().then(async () => {
      await app.electron.remote.app.setPath('userData', userDataDir);
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

  it('sends JSON request', async () => {
    const url = 'http://127.0.0.1:4010/pets/1';

    await debug.workspaceDropdownExists(app);
    await debug.createNewRequest(app, 'json');
    await debug.typeInUrlBar(app, url);
    await debug.clickSendRequest(app);

    await debug.expect200(app);
  });

  it('sends CSV request and shows rich response', async () => {
    const url = 'http://127.0.0.1:4010/csv';

    await debug.workspaceDropdownExists(app);
    await debug.createNewRequest(app, 'csv');
    await debug.typeInUrlBar(app, url);
    await debug.clickSendRequest(app);

    await debug.expect200(app);
    const csvViewer = await debug.getCsvViewer(app);
    await expect(csvViewer.getText()).resolves.toBe('a b c\n1 2 3');
  });

  it('sends PDF request and shows rich response', async () => {
    // Cannot mock the pdf response using Prism because it is not yet supported
    // https://github.com/stoplightio/prism/issues/1248#issuecomment-646056440
    const url = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';

    await debug.workspaceDropdownExists(app);
    await debug.createNewRequest(app, 'pdf');
    await debug.typeInUrlBar(app, url);
    await debug.clickSendRequest(app);

    await debug.expect200(app);
    const pdfCanvas = await debug.getPdfCanvas(app);
    // Investigate how we can extract text from the canvas, or compare images
    await expect(pdfCanvas.isExisting()).resolves.toBe(true);
  });
});
