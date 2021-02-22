import * as debug from '../modules/debug';
import * as client from '../modules/client';
import { launchApp, stop } from '../modules/application';
import * as dropdown from '../modules/dropdown';
import * as settings from '../modules/settings';
import fs from 'fs';
import { basicAuthCreds } from '../fixtures/constants';
import * as onboarding from '../modules/onboarding';
import * as migration from '../modules/migration';
import * as home from '../modules/home';

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    app = await launchApp();
  });

  afterEach(async () => {
    await stop(app);
  });

  it('can skip migration and proceed onboarding', async () => {
    await client.correctlyLaunched(app);

    await migration.migrationMessageShown(app);
    await migration.clickSkip(app);

    await onboarding.analyticsMessageShown(app);
    await onboarding.clickDontShare(app);
    await onboarding.clickSkipImport(app);

    await home.documentListingShown(app);
  });

  it('can migrate and proceed onboarding', async () => {
    await client.correctlyLaunched(app);

    await migration.migrationMessageShown(app);
    await migration.clickStart(app);
    await migration.successMessageShown(app);
    await migration.clickRestart(app);

    // Wait for app to restart
    await app.client.pause(2000);

    const count = await app.client.getWindowCount();
    if (count === 0) {
      console.log('No windows found');
    }

    await app.client.windowByIndex(0);

    await onboarding.analyticsMessageShown(app);
    await onboarding.clickDontShare(app);
    await onboarding.clickSkipImport(app);

    await home.documentListingShown(app);
    await home.expectDocumentWithTitle(app, 'FROM DESIGNER');
  });

  xit('shows an initial window', async () => {
    await client.correctlyLaunched(app);
    await debug.workspaceDropdownExists(app);
  });

  xit('sends JSON request', async () => {
    const url = 'http://127.0.0.1:4010/pets/1';

    await debug.workspaceDropdownExists(app);
    await debug.createNewRequest(app, 'json');
    await debug.typeInUrlBar(app, url);
    await debug.clickSendRequest(app);

    await debug.expect200(app);
  });

  xit.each([true, false])(
    'imports swagger 2 and sends request: new workspace=%s ',
    async newWorkspace => {
      await debug.workspaceDropdownExists(app);

      // Copy text to clipboard
      const buffer = await fs.promises.readFile(`${__dirname}/../fixtures/swagger2.yaml`);
      const swagger2Text = buffer.toString();
      await app.electron.clipboard.writeText(swagger2Text);

      // Click dropdown and open import modal
      const workspaceDropdown = await debug.clickWorkspaceDropdown(app);
      await dropdown.clickDropdownItemByText(workspaceDropdown, 'Import/Export');

      // Import from clipboard into new/current workspace
      await settings.importFromClipboard(app, newWorkspace);

      // Click imported folder and request
      await debug.clickFolderByName(app, 'custom-tag');
      await debug.clickRequestByName(app, 'get pet by id');

      // Click send
      await debug.clickSendRequest(app);

      // Ensure 200
      await debug.expect200(app);
    },
  );

  xit('sends CSV request and shows rich response', async () => {
    const url = 'http://127.0.0.1:4010/file/dummy.csv';

    await debug.workspaceDropdownExists(app);
    await debug.createNewRequest(app, 'csv');
    await debug.typeInUrlBar(app, url);
    await debug.clickSendRequest(app);

    await debug.expect200(app);
    const csvViewer = await debug.getCsvViewer(app);
    await expect(csvViewer.getText()).resolves.toBe('a b c\n1 2 3');
  });

  xit('sends PDF request and shows rich response', async () => {
    const url = 'http://127.0.0.1:4010/file/dummy.pdf';

    await debug.workspaceDropdownExists(app);
    await debug.createNewRequest(app, 'pdf');
    await debug.typeInUrlBar(app, url);
    await debug.clickSendRequest(app);

    await debug.expect200(app);
    const pdfCanvas = await debug.getPdfCanvas(app);
    // Investigate how we can extract text from the canvas, or compare images
    await expect(pdfCanvas.isExisting()).resolves.toBe(true);
  });

  // This test will ensure that for an endpoint which expects basic auth:
  //  1. sending no basic auth will fail
  //  2. sending basic auth will succeed
  //  3. sending basic auth with special characters encoded with IS0-8859-1 will succeed
  //  4. sending while basic auth is disabled within insomnnia will fail

  xit('sends request with basic authentication', async () => {
    const url = 'http://127.0.0.1:4010/auth/basic';
    const { latin1, utf8 } = basicAuthCreds;

    await debug.workspaceDropdownExists(app);
    await debug.createNewRequest(app, 'basic-auth');
    await debug.typeInUrlBar(app, url);

    // Send request with no auth present
    await debug.clickSendRequest(app);
    await debug.expect401(app);

    // Click auth tab
    await debug.clickRequestAuthTab(app);
    await debug.expectNoAuthSelected(app);

    // Select basic auth
    await debug.clickRequestAuthDropdown(app);
    await debug.clickBasicAuth(app);

    // Enter username and password with regular characters
    await debug.typeBasicAuthUsernameAndPassword(app, utf8.raw.user, utf8.raw.pass);

    // Send request with auth present
    await debug.clickSendRequest(app);
    await debug.expect200(app);

    const responseViewer = await debug.getResponseViewer(app);
    await debug.expectText(responseViewer, '1\nbasic auth received');

    // Check auth header in timeline
    await debug.clickTimelineTab(app);

    await debug.expectContainsText(
      await debug.getTimelineViewer(app),
      `> Authorization: Basic ${utf8.combined}`,
    );

    // Clear inputs and type username/password with special characters
    await debug.typeBasicAuthUsernameAndPassword(app, latin1.raw.user, latin1.raw.pass, true);

    // Toggle basic auth and encoding enabled
    await debug.toggleBasicAuthEncoding(app);

    // Send request
    await debug.clickSendRequest(app);
    await debug.expect200(app);

    await debug.expectContainsText(
      await debug.getTimelineViewer(app),
      `> Authorization: Basic ${latin1.combined}`,
    );

    // Toggle basic auth to disabled
    await debug.toggleBasicAuthEnabled(app);

    // Send request
    await debug.clickSendRequest(app);
    await debug.expect401(app);

    await debug.expectNotContainsText(await debug.getTimelineViewer(app), '> Authorization: Basic');
  });
});
