const workspaceDropdownExists = async (app, workspaceName = 'Insomnia') => {
  await app.client.waitUntilTextExists('.workspace-dropdown', workspaceName);
};

const createNewRequest = async (app, name = undefined) => {
  await app.client.$('.sidebar .dropdown .fa-plus-circle').then(e => e.click());

  await app.client
    .$('[aria-hidden=false]')
    .then(e => e.$('button*=New Request'))
    .then(e => e.click());

  // Wait for modal to open
  await app.client.waitUntilTextExists('.modal__header', 'New Request');

  // Set name and create request
  const input = await app.client.$('.modal input');

  if (name) {
    await input.waitUntil(() => input.isFocused());
    await input.keys(name);
  }

  await app.client
    .$('.modal .modal__footer')
    .then(e => e.$('button=Create'))
    .then(e => e.click());
};

const typeUrl = async (app, url) => {
  const urlEditor = await app.client.$('.urlbar .editor .input');
  await typeCodeMirror(urlEditor, url);
};

const typeCodeMirror = async (element, value) => {
  await element.click();
  const cm = await element.$('.CodeMirror');
  await cm.waitForExist();
  await cm.keys(value);
};

const clickSendRequest = async app => {
  await app.client.$('.urlbar__send-btn').then(e => e.click());
};

const expect200 = async app => {
  const tag = await app.client.$('.response-pane .pane__header .tag.bg-success');
  await tag.waitForDisplayed();
  await expect(tag.getText()).resolves.toBe('200 OK');
};

const getCsvViewer = async app => {
  const csvViewer = await app.client.react$('ResponseCSVViewer');
  await csvViewer.waitForDisplayed();
  return csvViewer;
};

module.exports = {
  workspaceDropdownExists,
  createNewRequest,
  typeUrl,
  clickSendRequest,
  expect200,
  getCsvViewer,
};
