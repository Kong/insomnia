const Application = require('spectron').Application;

describe('Application launch', () => {
  jest.setTimeout(10000);

  beforeEach(() => {
    this.app = new Application({
      path: '/Applications/Insomnia.app/Contents/MacOS/Insomnia',
      waitTimeout: 10000,
    });
    return this.app.start();
  });

  afterEach(() => {
    if (this.app && this.app.isRunning()) {
      return this.app.stop();
    }
  });

  it('shows an initial window', async () => {
    await this.app.client.waitUntilWindowLoaded();
    const count = await this.app.client.getWindowCount();
    expect(count).toBe(1);
  });
});
