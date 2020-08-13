const Application = require('spectron').Application;

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    app = new Application({
      path: '/Applications/Insomnia.app/Contents/MacOS/Insomnia',
      // Don't ask why, but don't remove chromeDriverArgs
      // https://github.com/electron-userland/spectron/issues/353#issuecomment-522846725
      chromeDriverArgs: ['remote-debugging-port=9222'],
    });
    await app.start();
  });

  afterEach(async () => {
    if (app && app.isRunning()) {
      await app.stop();
    }
  });

  it('shows an initial window', async () => {
    const count = await app.client.getWindowCount();
    expect(count).toBe(1);
  });
});
