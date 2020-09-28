import faker from 'faker';

export const workspaceDropdownExists = async (app, workspaceName = 'Insomnia') => {
  await app.client.waitUntilTextExists('.workspace-dropdown', workspaceName);
};

export const createNewRequest = async (app, name) => {
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

export const typeInUrlBar = async (app, url) => {
  const urlEditor = await app.client.react$('RequestUrlBar');
  await urlEditor.waitForExist();
  await urlEditor.click();
  await urlEditor.keys(url);
};

export const clickSendRequest = async app => {
  await app.client
    .react$('RequestUrlBar')
    .then(e => e.$('.urlbar__send-btn'))
    .then(e => e.click());
};

export const expect200 = async app => {
  const tag = await app.client.$('.response-pane .pane__header .tag.bg-success');
  await tag.waitForDisplayed();
  await expectText(tag, '200 OK');
};

export const expect401 = async app => {
  const tag = await app.client.$('.response-pane .pane__header .tag.bg-warning');
  await tag.waitForDisplayed();
  await expectText(tag, '401 Unauthorized');
};

export const getResponseViewer = async app => {
  // app.client.react$('ResponseViewer') doesn't seem to work because ResponseViewer is not a PureComponent
  const codeEditor = await app.client.$('.response-pane .editor');
  await codeEditor.waitForDisplayed();
  return codeEditor;
};

export const getCsvViewer = async app => {
  const csvViewer = await app.client.react$('ResponseCSVViewer');
  await csvViewer.waitForDisplayed();
  return csvViewer;
};

export const getPdfCanvas = async app => {
  const pdfViewer = await app.client.react$('ResponsePDFViewer');
  await pdfViewer.waitForDisplayed();
  const canvas = await pdfViewer.$('.S-PDF-ID canvas');
  await canvas.waitForDisplayed();
  return canvas;
};

export const clickRequestAuthDropdown = async app => {
  await app.client
    .react$('AuthDropdown')
    .then(e => e.react$('DropdownButton'))
    .then(e => e.click());
};

export const clickRequestAuthTab = async app => {
  await app.client
    .react$('RequestPane')
    .then(e => e.$('#react-tabs-2'))
    .then(e => e.click());
};

export const clickBasicAuth = async app => {
  await app.client
    .react$('AuthDropdown')
    .then(e => e.react$('DropdownItem', { props: { value: 'basic' } }))
    .then(e => e.click());

  // Wait for basic auth to be enabled on the request
  await app.client.pause(500);
};

export const expectNoAuthSelected = async app => {
  const wrapper = await app.client.react$('RequestPane').then(e => e.react$('AuthWrapper'));
  await wrapper.waitForDisplayed();
  await expectText(wrapper, 'Select an auth type from above');
};

export const typeBasicAuthUsernameAndPassword = async (app, username, password) => {
  const usernameEditor = await app.client.react$('OneLineEditor', {
    props: { id: 'username' },
  });
  await usernameEditor.waitForExist();
  await usernameEditor.click();
  await usernameEditor.keys(username);

  const passwordEditor = await app.client.react$('OneLineEditor', {
    props: { id: 'password' },
  });
  await passwordEditor.waitForExist();
  await passwordEditor.click();

  // Allow username changes to persist
  await app.client.pause(100);

  await passwordEditor.keys(password);

  // Allow password changes and encoding checkbox to persist
  await app.client.pause(100);

  await app.client.$('button#use-iso-8859-1').then(e => e.click());

  await app.client.pause(100);
};

export const expectText = async (element, text) => {
  await expect(element.getText()).resolves.toBe(text);
};

export const clickTimelineTab = async app => {
  await app.client
    .$('.response-pane')
    .then(e => e.$('#react-tabs-16'))
    .then(e => e.click());
};

export const getTimelineViewer = async app => {
  const viewer = await app.client.react$('ResponseTimelineViewer');
  await app.client.waitUntil(async () => (await viewer.getText()).length > 0);
  return viewer;
};
