import * as debug from '../modules/debug';
import * as client from '../modules/client';
import { launchCore, stop } from '../modules/application';

describe('Application launch', function() {
  jest.setTimeout(50000);
  let app = null;

  beforeEach(async () => {
    app = await launchCore();
  });

  afterEach(async () => {
    await stop(app);
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
