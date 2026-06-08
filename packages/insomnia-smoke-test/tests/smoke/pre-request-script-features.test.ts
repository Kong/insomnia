import { Buffer } from 'node:buffer';
import path from 'node:path';

import { expect } from '@playwright/test';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';

test.describe('pre-request features tests', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  const testCases = [
    {
      name: 'environments setting and overriding',
      expectedBody: {
        // fallbackToGlobal: 'fallbackToGlobal',
        fallbackToBase: 'fallbackToBase',
        scriptValue: 'fromEnv',
        preDefinedValue: 'fromScript',
        folderEnv: 'fromFolder',
      },
    },
    {
      name: 'variables / manipulate variables and set them to environment',
      expectedBody: {
        varStr: 'varStr',
        varNum: 777,
        varBool: true,
      },
    },
    {
      name: 'require / require classes from insomnia-collection module and init them',
      expectedBody: {
        propJson: {
          disabled: false,
          id: 'pid',
          name: 'pname',
        },
        headerJson: {
          key: 'headerKey',
          value: 'headerValue',
          id: '',
          name: '',
        },
      },
    },
    {
      name: 'insomnia.request manipulation',
      customVerify: (bodyJson: any) => {
        expect.soft(bodyJson.method).toBe('GET');
        expect.soft(bodyJson.headers['x-hello']).toBe('hello');
        expect.soft(bodyJson.data).toBe('rawContent');
      },
    },
    {
      name: 'insomnia.request auth manipulation (bearer)',
      customVerify: (bodyJson: any) => {
        const authzHeader = bodyJson.headers['authorization'];
        expect.soft(authzHeader != null).toBeTruthy();
        expect.soft(bodyJson.headers['authorization']).toBe('CustomTokenPrefix tokenValue');
      },
    },
    {
      name: 'insomnia.request auth manipulation (basic)',
      customVerify: (bodyJson: any) => {
        const authzHeader = bodyJson.headers['authorization'];
        expect.soft(authzHeader != null).toBeTruthy();
        const expectedEncCred = Buffer.from('myName:myPwd', 'utf8').toString('base64');
        expect.soft(bodyJson.headers['authorization']).toBe(`Basic ${expectedEncCred}`);
      },
    },
    {
      name: 'eval() works in script',
      expectedBody: {
        evalResult: 16,
      },
    },
    {
      name: 'require the url module',
      customVerify: (bodyJson: any) => {
        const reqBodyJsons = JSON.parse(bodyJson.data);
        expect.soft(reqBodyJsons).toEqual({
          hash: '#hashcontent',
          host: 'insomnia.com:6666',
          hostname: 'insomnia.com',
          href: 'https://user:pwd@insomnia.com:6666/p1?q1=a&q2=b#hashcontent',
          origin: 'https://insomnia.com:6666',
          password: 'pwd',
          pathname: '/p1',
          port: '6666',
          protocol: 'https:',
          search: '?q1=a&q2=b',
          username: 'user',
          seachParam: 'q1=a&q2=b',
        });
      },
    },
    {
      name: 'require node.js modules',
      expectedBody: {
        path: true,
        assert: true,
        buffer: true,
        util: true,
        url: true,
        punycode: true,
        querystring: true,
        stringDecoder: true,
        stream: true,
        timers: true,
        events: true,
      },
    },
    {
      name: 'get sendRequest response through await or callback',
      customVerify: (bodyJson: any) => {
        const requestBody = JSON.parse(bodyJson.data);
        expect.soft(requestBody.bodyFromAwait.method).toBe('GET');
        expect.soft(requestBody.bodyFromCallback.method).toBe('GET');
      },
    },
    {
      name: 'require the uuid module',
      expectedBody: {
        uuid: '00000000-0000-0000-0000-000000000000',
      },
    },
    {
      name: 'require external modules and built-in lodash',
      expectedBody: {
        atob: true,
        btoa: true,
        chai: true,
        cheerio: true,
        crypto: true,
        csv: true,
        lodash: true,
        moment: true,
        tv4: true,
        uuid: true,
        xml2js: true,
        builtInLodash: true,
      },
    },
    {
      name: 'not return until all Promise settled',
      expectedBody: {
        asyncTaskDone: true,
      },
    },
    {
      name: 'not return until all setTimeout finished',
      expectedBody: {
        asyncTaskDone: true,
      },
    },
    {
      name: 'not return until all async tasks finished',
      expectedBody: {
        asyncTaskDone: true,
      },
    },
    {
      name: 'run parent scripts only',
      expectedBody: {
        onlySetByFolderPreScript: 888,
      },
    },
    {
      name: 'manipulate folder envs',
      expectedBody: {
        folder1ValByReq: 1,
        folder1ValByReqByName: 1,
        folder2ValByReq: 2,
        folder2ValByReqByName: 2,
        valFound: 2,

        folder1ValByFolder1: 1,
        folder1ValByFolder1ByName: 1,
        folder2ValByFolder1: 2,
        folder2ValByFolder1ByName: 2,
        valFoundByFolder1: 2,

        folder1ValByFolder2: 1,
        folder1ValByFolder2ByName: 1,
        folder2ValByFolder2: 2,
        folder2ValByFolder2ByName: 2,
        valFoundByFolder2: 2,
      },
    },
  ].map(tc => {
    return {
      ...tc,
      customVerify:
        tc.customVerify ??
        (bodyJson => {
          expect.soft(JSON.parse(bodyJson.data)).toEqual(tc.expectedBody);
        }),
    };
  });

  test('run test cases', async ({ page, insomnia }) => {
    for (const tc of testCases) {
      console.log(`Running test case: ${tc.name}`);

      await insomnia.navigationSidebar.clickRequestOrFolder(tc.name);

      await page.getByTestId('request-pane').getByLabel('Params').click();
      await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
      // verify
      await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');

      const rows = await page
        .getByTestId('response-pane')
        .getByTestId('CodeEditor')
        .locator('.CodeMirror-line')
        .allInnerTexts();
      expect.soft(rows.length).toBeGreaterThan(0);

      const bodyJson = JSON.parse(rows.join(' '));
      tc.customVerify(bodyJson);
    }
  });

  test('send request with content type', async ({ page, insomnia }) => {
    await page.getByTestId('settings-button').click();
    await page.getByTestId('dataFolders').click();
    await page.getByTestId('dataFolders').fill(process.cwd());
    await page.getByTestId('dataFolders-btn').click();
    await page.getByRole('button', { name: 'Modal Close Button' }).click();
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    const responseBody = page.getByTestId('response-pane').getByTestId('CodeEditor').locator('.CodeMirror-line');

    await insomnia.navigationSidebar.clickRequestOrFolder('echo pre-request script result');

    // set request body
    await page.getByRole('tab', { name: 'Body' }).click();
    await page.getByRole('button', { name: 'Body' }).click();
    await page.getByRole('option', { name: 'JSON' }).click();

    const bodyEditor = page.getByTestId('CodeEditor').getByRole('textbox');
    await bodyEditor.fill(
      '{ "rawBody": {{ _.rawBody }}, "urlencodedBody": {{ _.urlencodedBody }}, "gqlBody": {{ _.gqlBody }}, "fileBody": {{ _.fileBody }}, "formdataBody": {{ _.formdataBody }} }',
    );

    // enter script
    await page.getByRole('tab', { name: 'Scripts' }).click();
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');
    await editor.fill(`
          const rawReq = {
              url: 'http://127.0.0.1:4010/echo',
              method: 'POST',
              header: {
                  'Content-Type': 'text/plain',
              },
              body: {
                  mode: 'raw',
                  raw: 'rawContent',
              },
          };
          const urlencodedReq = {
              url: 'http://127.0.0.1:4010/echo',
              method: 'POST',
              header: {
                  'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: {
                  mode: 'urlencoded',
                  urlencoded: [
                      { key: 'k1', value: 'v1' },
                      { key: 'k2', value: 'v2' },
                  ],
              },
          };
          const gqlReq = {
              url: 'http://127.0.0.1:4010/echo',
              method: 'POST',
              header: {
                  'Content-Type': 'application/graphql',
              },
              body: {
                  mode: 'graphql',
                  graphql: {
                      query: 'query',
                      operationName: 'operation',
                      variables: 'var',
                  },
              },
          };
          const fileReq = {
              url: 'http://127.0.0.1:4010/echo',
              method: 'POST',
              header: {
                  'Content-Type': 'application/octet-stream',
              },
              body: {
                  mode: 'file',
                  file: "${getFixturePath('files/rawfile.txt')}",
              },
          };
          const formdataReq = {
              url: 'http://127.0.0.1:4010/echo',
              method: 'POST',
              header: {
                  // TODO: try to understand why this breaks the test
                  // 'Content-Type': 'multipart/form-data',
              },
              body: {
                  mode: 'formdata',
                  formdata: [
                      { key: 'k1', type: 'text', value: 'v1' },
                      { key: 'k2', type: 'file', value: "${getFixturePath('files/rawfile.txt')}" },
                  ],
              },
          };
          const promises = [rawReq, urlencodedReq, gqlReq, fileReq, formdataReq].map(req => {
              return new Promise((resolve, reject) => {
                  insomnia.sendRequest(
                      req,
                      (err, resp) => {
                          if (err != null) {
                              reject(err);
                          } else {
                              resolve(resp);
                          }
                      }
                  );
              });
          });
          // send request
          const resps = await Promise.all(promises);
          // set envs
          insomnia.environment.set('rawBody', resps[0].body);
          insomnia.environment.set('urlencodedBody', resps[1].body);
          insomnia.environment.set('gqlBody', resps[2].body);
          insomnia.environment.set('fileBody', resps[3].body);
          insomnia.environment.set('formdataBody', resps[4].body);
          `);

    await page.getByRole('tab', { name: 'Body' }).click();

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify
    await expect.soft(statusTag).toContainText('200 OK');

    const rows = await responseBody.allInnerTexts();
    expect.soft(rows.length).toBeGreaterThan(0);

    const bodyJson = JSON.parse(rows.join(' '));

    const reqBodyJsons = JSON.parse(bodyJson.data);
    expect.soft(reqBodyJsons.rawBody.data).toBe('rawContent');
    expect.soft(reqBodyJsons.urlencodedBody.data).toBe('k1=v1&k2=v2');
    expect.soft(JSON.parse(reqBodyJsons.gqlBody.data)).toEqual({
      query: 'query',
      operationName: 'operation',
      variables: 'var',
    });
    expect.soft(reqBodyJsons.fileBody.data).toBe('raw file content');
    expect
      .soft(reqBodyJsons.formdataBody.data)
      .toBe(
        '--X-INSOMNIA-BOUNDARY\r\nContent-Disposition: form-data; name="k1"\r\n\r\nv1\r\n--X-INSOMNIA-BOUNDARY\r\nContent-Disposition: form-data; name="k2"; filename="rawfile.txt"\r\nContent-Type: text/plain\r\n\r\nraw file content\r\n--X-INSOMNIA-BOUNDARY--\r\n',
      );
  });

  test('insomnia.request / update proxy configuration', async ({ page, insomnia }) => {
    const responsePane = page.getByTestId('response-pane');

    // update proxy configuration
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();

    await page.getByLabel('Request timeout (ms)').fill('5000');
    await page.getByRole('tab', { name: 'Proxy' }).click();
    await page.locator('text=Enable proxy').click();
    await page.locator('[name="httpProxy"]').fill('localhost:1111');
    await page.locator('[name="httpsProxy"]').fill('localhost:2222');
    await page.locator('[name="noProxy"]').fill('http://a.com,https://b.com');
    await page.locator('.app').press('Escape');

    await insomnia.navigationSidebar.clickRequestOrFolder('test proxies manipulation');
    await page.getByRole('tab', { name: 'Body' }).click();
    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(responsePane).toContainText('localhost:1111'); // original proxy
    await expect.soft(responsePane).toContainText('Trying 127.0.0.1:8888'); // updated proxy
  });

  test('update clientCertificate if request url contains tag', async ({ page, insomnia }) => {
    const responsePane = page.getByTestId('response-pane');
    const fixturePath = getFixturePath('certificates');

    await page.getByTestId('settings-button').click();
    await page.getByTestId('dataFolders').fill(getFixturePath('fake.pfx'));
    await page.getByTestId('dataFolders-btn').click();
    await expect.soft(page.getByText('fake.pfx')).toBeVisible();

    await page.getByTestId('dataFolders').fill('invalid');
    await page.getByTestId('dataFolders-btn').click();
    await expect.soft(page.getByText('invalid')).toBeVisible();

    await page.locator('.app').press('Escape');

    // update proxy configuration
    await page.getByRole('button', { name: 'Add Certificates' }).click();
    await page.locator('text=Add client certificate').click();
    await page.locator('[name="host"]').fill('127.0.0.1:4010');
    await page.locator('[data-key="pfx"]').click();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('text=Add PFX or PKCS12 file').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(fixturePath, 'fake.pfx'));
    await page.getByRole('dialog').getByRole('button', { name: 'Add certificate' }).click();
    await page.getByRole('button', { name: 'Done' }).click();

    await insomnia.navigationSidebar.clickRequestOrFolder('test certificate manipulation with tagged url');
    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    // verify
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(responsePane).toContainText('* Adding SSL PEM certificate');
    await expect.soft(responsePane).toContainText('Adding SSL KEY certificate');
  });

  test('insomnia.request / update clientCertificate', async ({ page, insomnia }) => {
    const responsePane = page.getByTestId('response-pane');
    await insomnia.navigationSidebar.clickRequestOrFolder('test certificate manipulation');

    await page.getByTestId('settings-button').click();
    await page.getByTestId('dataFolders').fill('invalid');
    await page.getByTestId('dataFolders-btn').click();
    await expect.soft(page.getByText('invalid')).toBeVisible();
    await page.locator('.app').press('Escape');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    // verify
    await page.getByRole('tab', { name: 'Console' }).click();
    await expect.soft(responsePane).toContainText('Adding SSL PEM certificate');
    await expect.soft(responsePane).toContainText('Adding SSL KEY certificate');
  });

  test('insomnia.test and insomnia.expect can work together', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.clickRequestOrFolder('insomnia.test');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify
    await page.getByRole('tab', { name: 'Tests' }).click();

    const responsePane = page.getByTestId('response-pane');
    await expect
      .soft(responsePane)
      .toContainText(
        'FAILunhappy tests | error: AssertionError: expected 199 to deeply equal 200 | ACTUAL: 199 | EXPECTED: 200Pre-request Test',
      );
    await expect.soft(responsePane).toContainText('PASShappy tests');
  });

  test('environment and baseEnvironment can be persisted', async ({ app, page, insomnia }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await insomnia.navigationSidebar.clickRequestOrFolder('persist environment');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify response
    await expect.soft(statusTag).toContainText('200 OK');

    // verify persisted environment
    await page.getByRole('button', { name: 'Manage Environments' }).click();
    await page.getByRole('button', { name: 'Manage collection environments' }).click();
    const responseBody = page.getByRole('dialog').getByTestId('CodeEditor').locator('.CodeMirror-line');
    const rows = await responseBody.allInnerTexts();
    const bodyJson = JSON.parse(rows.join(' '));

    expect.soft(bodyJson).toEqual({
      // no environment is selected so the environment value will be persisted to the base environment
      fromUrlValue: 'fromUrlValue',
      fromEditorValue: 'fromEditorValue',
      __fromScript1: 'baseEnvironment',
      __fromScript2: 'collection',
      __fromScript: 'environment',
      examplehost: 'http://127.0.0.1:4010/echo',
      a: {
        b: {
          c: {
            url: 'http://127.0.0.1:4010/echo',
          },
        },
      },
    });
    // close modal and go back
    await page.locator('.app').press('Escape');
    await page.locator('.app').press('Escape');
    await page.getByTestId('workspace-breadcrumb-level-0').click();
    // import global environment
    const globalEnvText = await loadFixture('script-global-environment.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), globalEnvText);
    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
    await page.getByTestId('workspace-breadcrumb-level-0').click();

    await page.getByLabel('Pre-request Scripts', { exact: true }).click();
    // go to request collection
    await insomnia.navigationSidebar.requestRow('persist global environment').click({
      modifiers: ['ControlOrMeta'],
    });

    // activate global environment
    await page.getByLabel('Manage Environments').click();
    await page.getByPlaceholder('Choose a project environment').click();
    await page.getByRole('option', { name: 'Script Environment' }).click();
    await page.getByRole('option', { name: 'Base Script Env' }).click();
    await page.locator('body').click();
    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    // check when activate global base environment, globals and baseGlobals refer to the same env
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('log: globals base').click();
    await page.getByText('log: baseGlobals base').click();
    // view base environment has been updated
    await page.getByLabel('Manage Environments').click();
    await page.getByLabel('Manage project environment').click();
    await page.getByLabel('Environment name').getByText('Base Script Env').click();
    const globalBaseEditor = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
    const globalBaseRows = await globalBaseEditor.allInnerTexts();
    const globalBaseBodyJson = JSON.parse(globalBaseRows.join(' '));
    expect.soft(globalBaseBodyJson).toEqual({
      // if select global base environment, both globals and baseGlobals set method will point to global base environment
      __env_source: 'base',
      __fromGlobals: 'selectedGlobal',
      __fromBaseGlobals: 'selectedBaseGlobal',
    });

    // switch back to request collection tab
    await page.getByLabel('Insomnia Tabs').getByLabel('persist global environment').first().click();
    // activate global sub environment
    await page.getByLabel('Manage Environments').click();
    await page.getByRole('option', { name: 'Sub Script Env' }).click();
    await page.locator('body').click();
    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    // check when activate global sub environment, globals refers to the selected while baseGlobals refers to the base env
    await page.getByTestId('response-pane').getByRole('tab', { name: 'Console' }).click();
    await page.getByText('log: globals sub').click();
    await page.getByText('log: baseGlobals base').click();
    // view sub environment has been updated
    await page.getByLabel('Manage Environments').click();
    await page.getByLabel('Manage project environment').click();
    await page.getByLabel('Environment name').getByText('Sub Script Env').first().click();
    const globalSubEditor = page.getByTestId('CodeEditor').locator('.CodeMirror-line');
    const globalSubRows = await globalSubEditor.allInnerTexts();
    const globalSubBodyJson = JSON.parse(globalSubRows.join(' '));
    expect.soft(globalSubBodyJson).toEqual({
      // if select global sub environment, globals will point to the selected sub environment
      __env_source: 'sub',
      __fromGlobals: 'selectedGlobal',
    });
  });

  test('kv pair environment can be updated', async ({ page, insomnia }) => {
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await insomnia.navigationSidebar.clickRequestOrFolder('update kv pair environment');
    // switch to table view environment
    await page.getByLabel('Manage Environments').click();
    const manageBtn = page.getByRole('button', { name: 'Manage collection environments' });
    await expect.soft(manageBtn).toBeEnabled();
    await manageBtn.click();
    const tableEditBtn = page.getByLabel('Table Edit');
    await expect.soft(tableEditBtn).toBeEnabled();
    await tableEditBtn.click();
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Close' }) });
    await expect.soft(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await page.locator('body').click();

    // send request
    const sendBtn = page.getByTestId('request-pane').getByRole('button', { name: 'Send' });
    await expect.soft(sendBtn).toBeEnabled();
    await sendBtn.click();

    // verify response
    await expect.soft(statusTag).toContainText('200 OK');

    // verify table environments have been updated
    const verifyManageBtn = page.getByRole('button', { name: 'Manage Environments' });
    await expect.soft(verifyManageBtn).toBeEnabled();
    await verifyManageBtn.click();
    const verifyCollectionBtn = page.getByRole('button', { name: 'Manage collection environments' });
    await expect.soft(verifyCollectionBtn).toBeEnabled();
    await verifyCollectionBtn.click();
    await page.getByText('__environment_type').click();
    await page.getByText('__environment_value_kv').click();
    await page.getByText('http://url-from-script').click();
  });

  test('query params should be transformed correctly', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.clickRequestOrFolder('testQueryParams');

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify response
    const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
    await expect.soft(statusTag).toContainText('200 OK');

    const responsePane = page.getByTestId('response-pane');
    await page.getByRole('tab', { name: 'Console' }).click();

    await expect.soft(responsePane).toContainText('key=fromUrl');
    await expect.soft(responsePane).toContainText('key=fromUrlValue');
    await expect.soft(responsePane).toContainText('key=fromEditorValue');
    await expect.soft(responsePane).toContainText('key=%2F');
  });
});

test.describe('unhappy paths', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  test('custom errors are returned', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.clickRequestOrFolder('echo pre-request script result');

    // enter script
    await page.getByRole('tab', { name: 'Scripts' }).click();
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');
    await editor.fill(`throw Error('my custom error');`);
    await page.getByText('throw Error').click();

    // set request body
    await page.getByRole('tab', { name: 'Body' }).click();
    await page.getByRole('button', { name: 'Body' }).click();
    await page.getByRole('option', { name: 'JSON' }).click();

    await page.getByRole('tab', { name: 'Body' }).click();

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify
    await expect.soft(page.getByTestId('response-pane')).toContainText(`my custom error`);

    await page.getByRole('tab', { name: 'Scripts' }).click();
    await page.getByTestId('CodeEditor').getByRole('textbox').press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await editor.fill(`insomnia.INVALID_FIELD.set('', '')`);

    // CodeMirror debounces onChange by DEBOUNCE_MILLIS (100ms).
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));

    // send
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify
    await expect
      .soft(page.getByTestId('response-pane'))
      .toContainText(`Cannot read properties of undefined (reading 'set')`);
  });
});

test.describe('sandbox features', () => {
  test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

  test.beforeEach(async ({ app, page }) => {
    const text = await loadFixture('pre-request-collection.yaml');
    await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

    await page.getByLabel('Import').click();
    await page.locator('[data-test-id="import-from-clipboard"]').click();
    await page.getByRole('button', { name: 'Scan' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();
  });

  // Blocked Roots / Scopes group: 'this' is blocked.
  test('blocked roots / scopes group', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.clickRequestOrFolder('echo pre-request script result');

    await page.getByRole('tab', { name: 'Scripts' }).click();
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');

    // enter script that accesses a property on 'this'.
    await editor.fill(`insomnia.environment.set('result', String(this?.process));`);

    // CodeMirror debounces onChange by DEBOUNCE_MILLIS (100ms).
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));

    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify blocked-root error
    await expect
      .soft(page.getByTestId('response-pane'))
      .toContainText("The script was blocked because it used 'this'.");

    // navigate to Settings → Scripting, disable the "Scopes" blocked roots group
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.getByRole('tab', { name: 'Scripting' }).click();
    const scopesSwitch = page.locator('div:has(> h4:has-text("Scopes")) label[data-react-aria-pressable]');
    await scopesSwitch.scrollIntoViewIfNeeded();
    await scopesSwitch.click();

    await page.locator('.app').press('Escape');

    // re-send — no sandbox error; this === undefined.
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect
      .soft(page.getByTestId('response-pane'))
      .not.toContainText("The script was blocked because it used 'this'.");
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');
  });

  // Blocked Properties / Prototype Mutation group: 'prototype' is blocked.
  test('blocked properties / prototype mutation group', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.clickRequestOrFolder('echo pre-request script result');

    // enter script that accesses Object.prototype.
    await page.getByRole('tab', { name: 'Scripts' }).click();
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');
    await editor.fill(`insomnia.environment.set('result', typeof Object.prototype.toString);`);

    // CodeMirror debounces onChange by DEBOUNCE_MILLIS (100ms).
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));

    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify blocked-property error
    await expect
      .soft(page.getByTestId('response-pane'))
      .toContainText("The script was blocked because it used the property 'prototype'.");

    // navigate to Settings → Scripting, disable the "Prototype Mutation" blocked properties group
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.getByRole('tab', { name: 'Scripting' }).click();
    const protoMutationSwitch = page.locator(
      'div:has(> h4:has-text("Prototype Mutation")) label[data-react-aria-pressable]',
    );
    await protoMutationSwitch.scrollIntoViewIfNeeded();
    await protoMutationSwitch.click();
    await expect.soft(protoMutationSwitch).not.toHaveAttribute('data-selected');
    await page.locator('.app').press('Escape');

    // re-send — prototype access now allowed; Object.prototype.toString is a function
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect
      .soft(page.getByTestId('response-pane'))
      .not.toContainText("The script was blocked because it used the property 'prototype'.");
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');
  });

  // Mask Rules / Runtime APIs group: 'Function' is masked to undefined at runtime.
  test('Mask Rules / Runtime APIs group.', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.clickRequestOrFolder('echo pre-request script result');

    // enter script that uses the Function constructor, only masked at runtime.
    await page.getByRole('tab', { name: 'Scripts' }).click();
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');
    await editor.fill(`const f = new Function('return 42'); insomnia.environment.set('result', f());`);

    // CodeMirror debounces onChange by DEBOUNCE_MILLIS (100ms).
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));

    // send — Function masked to undefined → V8 uses the identifier name: "Function is not a constructor"
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    await expect.soft(page.getByTestId('response-pane')).toContainText('Function is not a constructor');

    // navigate to Settings → Scripting, disable the "Runtime APIs" mask group
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.getByRole('tab', { name: 'Scripting' }).click();
    const runtimeApisSwitch = page.locator('div:has(> h4:has-text("Runtime APIs")) label[data-react-aria-pressable]');
    await runtimeApisSwitch.scrollIntoViewIfNeeded();
    await runtimeApisSwitch.click();
    await expect.soft(runtimeApisSwitch).not.toHaveAttribute('data-selected');
    await page.locator('.app').press('Escape');

    // re-send — Function is now the real constructor; script returns 42
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect.soft(page.getByTestId('response-pane')).not.toContainText('Function is not a constructor');
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');
  });

  test('Layered security / unblocked properties resolve undefined', async ({ page, insomnia }) => {
    await insomnia.navigationSidebar.clickRequestOrFolder('echo pre-request script result');

    // enter script that accesses a property on 'process'.
    await page.getByRole('tab', { name: 'Scripts' }).click();
    const editor = page.getByTestId('CodeEditor').getByRole('textbox');
    await editor.fill(`insomnia.environment.set('result', String(process?.version));`);

    // CodeMirror debounces onChange by DEBOUNCE_MILLIS (100ms).
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 150)));

    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

    // verify blocked-root error
    await expect
      .soft(page.getByTestId('response-pane'))
      .toContainText("The script was blocked because it used 'process'.");

    // navigate to Settings → Scripting, disable only the "Node.js Internals" BLOCKED ROOTS group.
    await page.getByTestId('settings-button').click();
    await page.locator('text=Insomnia Preferences').first().click();
    await page.getByRole('tab', { name: 'Scripting' }).click();
    const nodeInternalsSwitch = page.locator(
      'xpath=//h4[normalize-space(text())="Node.js Internals"]/following-sibling::div[1]//label[@data-react-aria-pressable]',
    );
    await nodeInternalsSwitch.scrollIntoViewIfNeeded();
    await nodeInternalsSwitch.click();
    await expect.soft(nodeInternalsSwitch).not.toHaveAttribute('data-selected');
    await page.locator('.app').press('Escape');

    // process?.version === undefined.
    await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
    await expect
      .soft(page.getByTestId('response-pane'))
      .not.toContainText("The script was blocked because it used 'process'.");
    await expect.soft(page.locator('[data-testid="response-status-tag"]:visible')).toContainText('200 OK');
  });
});
