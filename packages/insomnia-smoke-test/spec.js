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
    await expect(app.browserWindow.isDevToolsOpened()).resolves.toBe(false);
    await expect(app.client.getWindowCount()).resolves.toBe(1);
    await expect(app.browserWindow.isMinimized()).resolves.toBe(false);
    await expect(app.browserWindow.isFocused()).resolves.toBe(true);
    await app.client.waitUntilTextExists('.workspace-dropdown', 'Insomnia');
  });

  it('create a request', async () => {
    await app.client.waitUntilTextExists('.workspace-dropdown', 'Insomnia');

    // Click on plus
    const btn = await app.client.$('.sidebar .dropdown .fa-plus-circle');
    await btn.click();

    // Click on new request
    await app.client
      .$('[aria-hidden=false]')
      .then(e => e.$('button*=New Request'))
      .then(e => e.click());

    // Wait for modal to open
    await app.client.waitUntilTextExists('.modal__header', 'New Request');

    // Set name and create request
    const input = await app.client.$('.modal input');
    await app.client.waitUntil(() => input.isFocused());
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
    await urlEditor.keys('https://petstore.swagger.io/v2/pet/findByStatus?status=available');

    // Send request
    await app.client.$('.urlbar__send-btn').then(e => e.click());

    // Expect 200
    await app.client
      .$('.response-pane .pane__header .tag.bg-success')
      .then(e => e.getText())
      .then(e => expect(e).toBe('200 OK'));
  });
});
