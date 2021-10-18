import faker from 'faker';
import { Application } from 'spectron';
import spectronKeys from 'spectron-keys';

import { COMPONENT_NAMES } from './component-names';

export const workspaceDropdownExists = async (app: Application, workspaceName = 'Insomnia') => {
  await app.client.waitUntilTextExists('.workspace-dropdown', workspaceName);
};

export const pageDisplayed = async (app: Application) => {
  await app.client.react$('WrapperDebug').then(e => e.waitForDisplayed());
};

export const clickWorkspaceDropdown = async (app: Application) => {
  const dropdown = await app.client.react$('WorkspaceDropdown');
  await dropdown.click();
  return dropdown;
};

export const goToDashboard = async (app: Application) => {
  await app.client.$('.header_left a').then(e => e.click());
};

export const createNewRequest = async (app: Application, name: string) => {
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

const waitUntilRequestIsActive = async (app: Application, name: string) => {
  const request = await app.client.react$(COMPONENT_NAMES.sidebarRequestRow, {
    props: { isActive: true, request: { name } },
  });

  await request.waitForDisplayed();
};

export const clickFolderByName = async (app: Application, name: string) => {
  const folder = await app.client.react$(COMPONENT_NAMES.sidebarRequestGroupRow, {
    props: { requestGroup: { name } },
  });

  await folder.waitForClickable();
  await folder.click();
};

export const clickRequestByName = async (app: Application, name: string) => {
  const folder = await app.client.react$(COMPONENT_NAMES.sidebarRequestRow, {
    props: { request: { name } },
  });

  await folder.waitForClickable();
  await folder.click();
};

export const typeInUrlBar = async (app: Application, url) => {
  const urlEditor = await app.client.react$(COMPONENT_NAMES.requestUrlBar);
  await urlEditor.waitForExist();
  await urlEditor.click();
  await urlEditor.keys(url);
};

export const clickSendRequest = async (app: Application) => {
  await app.client
    .react$(COMPONENT_NAMES.requestUrlBar)
    .then(e => e.$('.urlbar__send-btn'))
    .then(e => e.click());

  // Wait for spinner to show
  const spinner = await app.client.react$('ResponseTimer');
  await spinner.waitForDisplayed();

  // Wait for spinner to hide
  await spinner.waitForDisplayed({ reverse: true });
};

export const expect200 = async (app: Application) => {
  const tag = await app.client.$('.response-pane .pane__header .tag.bg-success');
  await tag.waitForDisplayed();
  await expectText(tag, '200 OK');
};

export const expect401 = async (app: Application) => {
  const tag = await app.client.$('.response-pane .pane__header .tag.bg-warning');
  await tag.waitForDisplayed();
  await expectText(tag, '401 Unauthorized');
};

export const getResponseViewer = async (app: Application) => {
  // app.client.react$('ResponseViewer') doesn't seem to work because ResponseViewer is not a PureComponent
  const codeEditor = await app.client.$('.response-pane .editor');
  await codeEditor.waitForDisplayed();
  return codeEditor;
};

export const getTimelineViewer = async (app: Application) => {
  const codeEditor = await app.client.react$('ResponseTimelineViewer');
  await codeEditor.waitForDisplayed();
  return codeEditor;
};

export const getCsvViewer = async (app: Application) => {
  const csvViewer = await app.client.react$('ResponseCSVViewer');
  await csvViewer.waitForDisplayed();
  return csvViewer;
};

export const getPdfCanvas = async (app: Application) => {
  const pdfViewer = await app.client.react$('ResponsePDFViewer');
  await pdfViewer.waitForDisplayed();
  const canvas = await pdfViewer.$('.S-PDF-ID canvas');
  await canvas.waitForDisplayed();
  return canvas;
};

export const clickRequestAuthDropdown = async (app: Application) => {
  await app.client
    .react$('AuthDropdown')
    .then(e => e.react$('DropdownButton'))
    .then(e => e.click());
};

export const clickRequestAuthTab = async (app: Application) => {
  await app.client
    .react$('RequestPane')
    .then(e => e.$('#react-tabs-2'))
    .then(e => e.click());
};

const basicAuthPause = 300;

export const clickBasicAuth = async (app: Application) => {
  await app.client
    .react$('AuthDropdown')
    .then(e => e.react$('DropdownItem', { props: { value: 'basic' } }))
    .then(e => e.click());

  // Wait for basic auth to be enabled on the request
  await app.client.pause(basicAuthPause);
};

export const expectNoAuthSelected = async (app: Application) => {
  const wrapper = await app.client.react$('RequestPane').then(e => e.react$('AuthWrapper'));
  await wrapper.waitForDisplayed();
  await expectText(wrapper, 'Select an auth type from above');
};

export const typeBasicAuthUsernameAndPassword = async (app: Application, username: string, password: string, clear = false) => {
  const basicAuth = await app.client.react$('BasicAuth');
  await basicAuth.waitForExist();

  const usernameEditor = await app.client.react$('OneLineEditor', {
    props: { id: 'username' },
  });
  await usernameEditor.waitForExist();
  await usernameEditor.click();

  // Wait for the username editor field to update
  await app.client.pause(basicAuthPause);

  if (clear) {
    await selectAll(app);
  }
  await usernameEditor.keys(username);

  const passwordEditor = await app.client.react$('OneLineEditor', {
    props: { id: 'password' },
  });
  await passwordEditor.waitForExist();
  await passwordEditor.click();

  // Allow username changes to persist and wait for
  // the password editor field to update
  await app.client.pause(basicAuthPause);

  if (clear) {
    await selectAll(app);
  }
  await passwordEditor.keys(password);

  // Allow password changes to persist
  await app.client.pause(basicAuthPause);
};

export const toggleBasicAuthEnabled = async (app: Application) => {
  await app.client
    .react$('BasicAuth')
    .then(e => e.$('button#enabled'))
    .then(e => e.click());
  // Allow toggle to persist
  await app.client.pause(basicAuthPause);
};

export const toggleBasicAuthEncoding = async (app: Application) => {
  await app.client
    .react$('BasicAuth')
    .then(e => e.$('button#use-iso-8859-1'))
    .then(e => e.click());

  // Allow toggle to persist
  await app.client.pause(basicAuthPause);
};

export const expectText = async (element: WebdriverIO.Element, text: string) => {
  await expect(element.getText()).resolves.toBe(text);
};

export const expectContainsText = async (element: WebdriverIO.Element, text: string) => {
  await expect(element.getText()).resolves.toContain(text);
};

export const expectNotContainsText = async (element: WebdriverIO.Element, text: string) => {
  await expect(element.getText()).resolves.not.toContain(text);
};

export const clickTimelineTab = async (app: Application) => {
  await app.client
    .$('.response-pane')
    .then(e => e.$('#react-tabs-16'))
    .then(e => e.click());

  // Wait until some text shows
  const codeEditor = await getTimelineViewer(app);
  await app.client.waitUntil(async () => Boolean(codeEditor.getText()));
};

export const selectAll = async (app: Application) => {
  await app.client.keys(spectronKeys.mapAccelerator('CommandOrControl+A'));
};

export const typeInResponseFilter = async (app: Application, filter: string) => {
  const toolbar = await app.client.$('.response-pane .editor__toolbar');
  await toolbar.waitForExist();
  await toolbar.click();

  await toolbar.keys(filter);
};
