import path from 'node:path';

import { expect } from '@playwright/test';
import { Buffer } from 'buffer';

import { getFixturePath, loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';;

test.describe('pre-request features tests', async () => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    test.beforeEach(async ({ app, page }) => {
        const text = await loadFixture('pre-request-collection.yaml');
        await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

        await page.getByLabel('Import').click();
        await page.locator('[data-test-id="import-from-clipboard"]').click();
        await page.getByRole('button', { name: 'Scan' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

        await page.getByLabel('Pre-request Scripts').click();
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
                    type: '',
                },
            },
        },
        {
            name: 'insomnia.request manipulation',
            customVerify: (bodyJson: any) => {
                expect(bodyJson.method).toEqual('GET');
                expect(bodyJson.headers['x-hello']).toEqual('hello');
                expect(bodyJson.data).toEqual('rawContent');
            },
        },
        {
            name: 'insomnia.request auth manipulation (bearer)',
            customVerify: (bodyJson: any) => {
                const authzHeader = bodyJson.headers['authorization'];
                expect(authzHeader != null).toBeTruthy();
                expect(bodyJson.headers['authorization']).toEqual('CustomTokenPrefix tokenValue');
            },
        },
        {
            name: 'insomnia.request auth manipulation (basic)',
            customVerify: (bodyJson: any) => {
                const authzHeader = bodyJson.headers['authorization'];
                expect(authzHeader != null).toBeTruthy();
                const expectedEncCred = Buffer.from('myName:myPwd', 'utf-8').toString('base64');
                expect(bodyJson.headers['authorization']).toEqual(`Basic ${expectedEncCred}`);
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
                expect(reqBodyJsons).toEqual({
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
                expect(requestBody.bodyFromAwait.method).toEqual('GET');
                expect(requestBody.bodyFromCallback.method).toEqual('GET');
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
                'onlySetByFolderPreScript': 888,
            },
        },
        {
            name: 'manipulate folder envs',
            expectedBody: {
                'folder1ValByReq': 1,
                'folder1ValByReqByName': 1,
                'folder2ValByReq': 2,
                'folder2ValByReqByName': 2,
                'valFound': 2,

                'folder1ValByFolder1': 1,
                'folder1ValByFolder1ByName': 1,
                'folder2ValByFolder1': 2,
                'folder2ValByFolder1ByName': 2,
                'valFoundByFolder1': 2,

                'folder1ValByFolder2': 1,
                'folder1ValByFolder2ByName': 1,
                'folder2ValByFolder2': 2,
                'folder2ValByFolder2ByName': 2,
                'valFoundByFolder2': 2,
            },
        },
    ];

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];

        test(tc.name, async ({ page }) => {
            const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
            const responseBody = page.getByTestId('response-pane').getByTestId('CodeEditor').locator('.CodeMirror-line');

            await page.getByLabel('Request Collection').getByTestId(tc.name).press('Enter');

            // send
            await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

            // verify
            await page.waitForSelector('[data-testid="response-status-tag"]:visible');

            await expect(statusTag).toContainText('200 OK');

            const rows = await responseBody.allInnerTexts();
            expect(rows.length).toBeGreaterThan(0);

            const bodyJson = JSON.parse(rows.join(' '));
            if (tc.expectedBody) {
                expect(JSON.parse(bodyJson.data)).toEqual(tc.expectedBody);
            }
            if (tc.customVerify) {
                tc.customVerify(bodyJson);
            }
        });
    }

    test('send request with content type', async ({ page }) => {
        const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
        const responseBody = page.getByTestId('response-pane').getByTestId('CodeEditor').locator('.CodeMirror-line');

        await page.getByLabel('Request Collection').getByTestId('echo pre-request script result').press('Enter');

        // set request body
        await page.getByRole('tab', { name: 'Body' }).click();
        await page.getByRole('button', { name: 'Body' }).click();
        await page.getByRole('option', { name: 'JSON' }).click();

        const bodyEditor = page.getByTestId('CodeEditor').getByRole('textbox');
        await bodyEditor.fill('{ "rawBody": {{ _.rawBody }}, "urlencodedBody": {{ _.urlencodedBody }}, "gqlBody": {{ _.gqlBody }}, "fileBody": {{ _.fileBody }}, "formdataBody": {{ _.formdataBody }} }');

        // enter script
        await page.getByRole('tab', { name: 'Scripts' }).click();
        const preRequestScriptEditor = page.getByTestId('CodeEditor').getByRole('textbox');
        await preRequestScriptEditor.fill(`
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

        // TODO: wait for body and pre - request script are persisted to the disk
        // should improve this part, we should avoid sync this state through db as it introduces race condition
        await page.waitForTimeout(500);

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify
        await page.waitForSelector('[data-testid="response-status-tag"]:visible');

        await expect(statusTag).toContainText('200 OK');

        const rows = await responseBody.allInnerTexts();
        expect(rows.length).toBeGreaterThan(0);

        const bodyJson = JSON.parse(rows.join(' '));

        const reqBodyJsons = JSON.parse(bodyJson.data);
        expect(reqBodyJsons.rawBody.data).toEqual('rawContent');
        expect(reqBodyJsons.urlencodedBody.data).toEqual('k1=v1&k2=v2');
        expect(JSON.parse(reqBodyJsons.gqlBody.data)).toEqual({
            query: 'query',
            operationName: 'operation',
            variables: 'var',
        });
        expect(reqBodyJsons.fileBody.data).toEqual('raw file content');
        expect(reqBodyJsons.formdataBody.data).toEqual('--X-INSOMNIA-BOUNDARY\r\nContent-Disposition: form-data; name=\"k1\"\r\n\r\nv1\r\n--X-INSOMNIA-BOUNDARY\r\nContent-Disposition: form-data; name=\"k2\"; filename=\"rawfile.txt\"\r\nContent-Type: text/plain\r\n\r\nraw file content\r\n--X-INSOMNIA-BOUNDARY--\r\n');
    });

    test('insomnia.request / update proxy configuration', async ({ page }) => {
        const responsePane = page.getByTestId('response-pane');

        // update proxy configuration
        await page.locator('[data-testid="settings-button"]').click();
        await page.locator('text=Insomnia Preferences').first().click();
        await page.getByRole('tab', { name: 'Proxy' }).click();
        await page.locator('text=Enable proxy').click();
        await page.locator('[name="httpProxy"]').fill('localhost:1111');
        await page.locator('[name="httpsProxy"]').fill('localhost:2222');
        await page.locator('[name="noProxy"]').fill('http://a.com,https://b.com');
        await page.locator('.app').press('Escape');
        // add 1s timeout to ensure noProxy settings is applied - INS-4155
        await page.waitForTimeout(1000);

        await page.getByLabel('Request Collection').getByTestId('test proxies manipulation').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify
        await page.getByRole('tab', { name: 'Console' }).click();
        await expect(responsePane).toContainText('localhost:2222'); // original proxy
        await expect(responsePane).toContainText('Trying 127.0.0.1:8888'); // updated proxy
    });

    test('update clientCertificate if request url contains tag', async ({ page }) => {
        const responsePane = page.getByTestId('response-pane');
        const fixturePath = getFixturePath('certificates');

        // update proxy configuration
        await page.locator('text=Add Certificates').click();
        await page.locator('text=Add client certificate').click();
        await page.locator('[name="host"]').fill('127.0.0.1:4010');
        await page.locator('[data-key="pfx"]').click();

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('text=Add PFX or PKCS12 file').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(path.join(fixturePath, 'fake.pfx'));
        await page.getByRole('button', { name: 'Add certificate' }).click();
        await page.getByRole('button', { name: 'Done' }).click();

        await page.getByLabel('Request Collection').getByTestId('test certificate manipulation with tagged url').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        // verify
        await page.getByRole('tab', { name: 'Console' }).click();
        await expect(responsePane).toContainText('* Adding SSL PEM certificate');
        await expect(responsePane).toContainText('Adding SSL KEY certificate');
    });

    test('insomnia.request / update clientCertificate', async ({ page }) => {
        const responsePane = page.getByTestId('response-pane');
        await page.getByLabel('Request Collection').getByTestId('test certificate manipulation').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        // verify
        await page.getByRole('tab', { name: 'Console' }).click();
        await expect(responsePane).toContainText('Adding SSL PEM certificate');
        await expect(responsePane).toContainText('Adding SSL KEY certificate');
    });

    test('pre: insomnia.test and insomnia.expect can work together', async ({ page }) => {
        await page.getByLabel('Request Collection').getByTestId('insomnia.test').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify
        await page.getByRole('tab', { name: 'Tests' }).click();

        const responsePane = page.getByTestId('response-pane');
        expect(responsePane).toContainText('FAILunhappy tests | error: AssertionError: expected 199 to deeply equal 200 | ACTUAL: 199 | EXPECTED: 200Pre-request Test');
        expect(responsePane).toContainText('PASShappy tests');
    });

    test('environment and baseEnvironment can be persisted', async ({ page }) => {
        const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
        await page.getByLabel('Request Collection').getByTestId('persist environment').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify response
        await page.waitForSelector('[data-testid="response-status-tag"]:visible');
        await expect(statusTag).toContainText('200 OK');

        // verify persisted environment
        await page.getByRole('button', { name: 'Manage Environments' }).click();
        await page.getByRole('button', { name: 'Manage collection environments' }).click();
        const responseBody = page.getByRole('dialog').getByTestId('CodeEditor').locator('.CodeMirror-line');
        const rows = await responseBody.allInnerTexts();
        const bodyJson = JSON.parse(rows.join(' '));

        expect(bodyJson).toEqual({
            // no environment is selected so the environment value will be persisted to the base environment
            '__fromScript1': 'baseEnvironment',
            '__fromScript2': 'collection',
            '__fromScript': 'environment',
            'examplehost': 'https://mock.insomnia.rest',
            'a': {
                'b': {
                    'c': {
                        'url': 'https://mock.insomnia.rest',
                    },
                },
            },
        });
    });

    test('kv pair environment can be updated', async ({ page }) => {
        const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
        await page.getByLabel('Request Collection').getByTestId('update kv pair environment').press('Enter');
        // switch to table view environment
        await page.getByLabel('Manage Environments').click();
        await page.getByRole('button', { name: 'Manage collection environments' }).click();
        await page.getByLabel('Table Edit').click();
        await page.getByRole('button', { name: 'Close' }).click();
        await page.getByTestId('underlay').click();

        // send request
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify response
        await page.waitForSelector('[data-testid="response-status-tag"]:visible');
        await expect(statusTag).toContainText('200 OK');

        // verify table environments have been updated
        await page.getByRole('button', { name: 'Manage Environments' }).click();
        await page.getByRole('button', { name: 'Manage collection environments' }).click();
        await page.getByText('__environment_type').click();
        await page.getByText('__environment_value_kv').click();
        await page.getByText('http://url-from-script').click();
    });
});

test.describe('unhappy paths', async () => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    test.beforeEach(async ({ app, page }) => {
        const text = await loadFixture('pre-request-collection.yaml');
        await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

        await page.getByLabel('Import').click();
        await page.locator('[data-test-id="import-from-clipboard"]').click();
        await page.getByRole('button', { name: 'Scan' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

        await page.getByLabel('Pre-request Scripts').click();
    });

    const testCases = [
        {
            name: 'custom error is returned',
            preReqScript: `
          throw Error('my custom error');
          `,
            context: {
                insomnia: {},
            },
            expectedResult: {
                message: 'my custom error',
            },
        },
        {
            name: 'syntax error',
            preReqScript: `
          insomnia.INVALID_FIELD.set('', '')
          `,
            context: {
                insomnia: {},
            },
            expectedResult: {
                message: "Cannot read properties of undefined (reading 'set')",
            },
        },
    ];

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];

        test(tc.name, async ({ page }) => {
            const responsePane = page.getByTestId('response-pane');

            await page.getByLabel('Request Collection').getByTestId('echo pre-request script result').press('Enter');

            // set request body
            await page.getByRole('tab', { name: 'Body' }).click();
            await page.getByRole('button', { name: 'Body' }).click();
            await page.getByRole('option', { name: 'JSON' }).click();

            // enter script
            await page.getByRole('tab', { name: 'Scripts' }).click();
            const preRequestScriptEditor = page.getByTestId('CodeEditor').getByRole('textbox');
            await preRequestScriptEditor.fill(tc.preReqScript);

            // TODO: wait for body and pre-request script are persisted to the disk
            // should improve this part, we should avoid sync this state through db as it introduces race condition
            await page.waitForTimeout(500);

            // send
            await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

            // verify
            await page.waitForSelector('[data-testid="response-status-tag"]:visible');
            await expect(responsePane).toContainText(tc.expectedResult.message);
        });
    }
});
