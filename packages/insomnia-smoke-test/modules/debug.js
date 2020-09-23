const faker = require('faker');

const workspaceDropdownExists = async (app, workspaceName = 'Insomnia') => {
  await app.client.waitUntilTextExists('.workspace-dropdown', workspaceName);
};

const createNewRequest = async (app, name) => {
  await app.client.$('.sidebar .dropdown .fa-plus-circle').then(e => e.click());

  await app.client
    .$('[aria-hidden=false]')
    .then(e => e.$('button*=New Request'))
    .then(e => e.click());

  // Wait for modal to open
  await app.client.waitUntilTextExists('.modal__header', 'New Request');

  // Set name and create request
  const input = await app.client.$('.modal input');

  const requestName = `${name}-${faker.lorem.slug()}`;
  await input.waitUntil(() => input.isFocused());
  await input.keys(requestName);

  await app.client
    .$('.modal .modal__footer')
    .then(e => e.$('button=Create'))
    .then(e => e.click());

  await waitUntilRequestIsActive(app, requestName);
};

const waitUntilRequestIsActive = async (app, name) => {
  const requestIsActive = async () => {
    const requests = await app.client.react$$('SidebarRequestRow', { props: { isActive: true } });
    const firstRequest = requests[0];
    const activeRequestName = await firstRequest.react$('Editable').then(e => e.getText());
    return activeRequestName === name;
  };

  await app.client.waitUntil(requestIsActive);
};

const typeInUrlBar = async (app, url) => {
  const urlEditor = await app.client.react$('RequestUrlBar');
  await urlEditor.waitForExist();
  await urlEditor.click();
  await urlEditor.keys(url);
};

const clickSendRequest = async app => {
  await app.client
    .react$('RequestUrlBar')
    .then(e => e.$('.urlbar__send-btn'))
    .then(e => e.click());
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

const getPdfCanvas = async app => {
  const pdfViewer = await app.client.react$('ResponsePDFViewer');
  await pdfViewer.waitForDisplayed();
  const canvas = await pdfViewer.$('.S-PDF-ID canvas');
  await canvas.waitForDisplayed();
  return canvas;
};

module.exports = {
  workspaceDropdownExists,
  createNewRequest,
  typeInUrlBar,
  clickSendRequest,
  expect200,
  getCsvViewer,
  getPdfCanvas,
};
