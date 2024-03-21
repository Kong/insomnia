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

        await page.getByRole('button', { name: 'Create in project' }).click();
        await page.getByRole('menuitemradio', { name: 'Import' }).click();
        await page.locator('[data-test-id="import-from-clipboard"]').click();
        await page.getByRole('button', { name: 'Scan' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

        await page.getByLabel('Pre-request Scripts').click();
    });

    const testCases = [
        {
            name: 'environments setting/overriding',
            preReqScript: `
                insomnia.baseEnvironment.set('fromBaseEnv', 'baseEnv');
                insomnia.baseEnvironment.set('scriptValue', 'fromBase');
                insomnia.environment.set('scriptValue', 'fromEnv');
                // "preDefinedValue" is already defined in the base environment modal.
                // but it is rewritten here
                insomnia.baseEnvironment.set('preDefinedValue', 'fromScript');
                // "customValue" is already defined in the folder environment.
                // folder version will override the following one
                insomnia.baseEnvironment.set('customValue', 'fromScript');
            `,
            body: `{
"fromBaseEnv": "{{ _.fromBaseEnv }}",
"scriptValue": "{{ _.scriptValue }}",
"preDefinedValue": "{{ _.preDefinedValue }}",
"customValue": "{{ _.customValue }}"
            }`,
            expectedBody: {
                fromBaseEnv: 'baseEnv',
                scriptValue: 'fromEnv',
                preDefinedValue: 'fromScript',
                customValue: 'fromFolder',
            },
        },
        {
            name: 'variables / manipulate variables and set them to environment',
            preReqScript: `
                // set local
                pm.variables.set('varStr', 'varStr');
                pm.variables.set('varNum', 777);
                pm.variables.set('varBool', true);
                // has
                pm.environment.set('varStr', pm.variables.get('varStr'));
                pm.environment.set('varNum', pm.variables.get('varNum'));
                pm.environment.set('varBool', pm.variables.get('varBool'));
            `,
            body: `{
"varStr": "{{ _.varStr }}",
"varNum": {{ _.varNum }},
"varBool": {{ _.varBool }}
            }`,
            expectedBody: {
                varStr: 'varStr',
                varNum: 777,
                varBool: true,
            },
        },
        {
            name: 'require / require classes from insomnia-collection module and init them',
            preReqScript: `
            const { Property, Header, Variable, QueryParam, Url, RequestAuth, ProxyConfig, Cookie, Certificate, RequestBody, Request, Response } = require('insomnia-collection');
            const prop = new Property('pid', 'pname');
            const header = new Header({ key: 'headerKey', value: 'headerValue' });
            const variable = new Variable({ key: 'headerKey', value: 'headerValue' });
            const qParam = new QueryParam({ key: 'queryKey', value: 'queryValue' });
            const url = new Url({
                host: ['insomnia', 'rest'],
                path: ['path1', 'path2'],
                protocol: 'https',
            });
            const proxyConfig = new ProxyConfig({
                match: 'http+https://*.example.com:80/*',
                host: 'proxy.com',
                port: 8080,
                tunnel: true,
                disabled: false,
                authenticate: true,
                username: 'proxy_username',
                password: 'proxy_password',
            });
            const reqAuth = new RequestAuth({
                type: 'basic',
                basic: [
                    { key: 'username', value: 'user1' },
                    { key: 'password', value: 'pwd1' },
                ],
            });
            const cookie = new Cookie({ key: 'queryKey', value: 'queryValue' });
            const cert = new Certificate({
                name: 'Certificate for example.com',
                matches: ['https://example.com'],
                key: { src: '/User/path/to/certificate/key' },
                cert: { src: '/User/path/to/certificate' },
                passphrase: 'iampassphrase',
            });
            const reqBody = new RequestBody({
                mode: 'urlencoded',
                urlencoded: [
                    { key: 'urlencodedKey', value: 'urlencodedValue' },
                ],
                options: {},
            });
            const req = new Request({
                url: 'https://hostname.com/path',
                method: 'GET',
                header: [
                    { key: 'header1', value: 'val1' },
                    { key: 'header2', value: 'val2' },
                ],
                body: {
                    mode: 'raw',
                    raw: 'body content',
                },
                auth: {
                    type: 'basic',
                    basic: [
                        { key: 'username', value: 'myname' },
                        { key: 'password', value: 'mypwd' },
                    ],
                },
                proxy: undefined,
                certificate: undefined,
            });
            const resp = new Response({
                code: 200,
                reason: 'OK',
                header: [
                    { key: 'header1', value: 'val1' },
                    { key: 'header2', value: 'val2' },
                    { key: 'Content-Length', value: '100' },
                    { key: 'Content-Disposition', value: 'attachment; filename="filename.txt"' },
                    { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
                ],
                cookie: [
                    { key: 'header1', value: 'val1' },
                    { key: 'header2', value: 'val2' },
                ],
                body: '{"key": 888}',
                stream: undefined,
                responseTime: 100,
                status: 'OK',
                originalRequest: req,
            });
            // set part of values
            insomnia.environment.set('propJson', JSON.stringify(prop.toJSON()));
            insomnia.environment.set('headerJson', JSON.stringify(header.toJSON()));
            `,
            body: `{
"propJson": {{ _.propJson }},
"headerJson": {{ _.headerJson }}
            }`,
            expectedBody: {
                propJson: {
                    '_kind': 'Property',
                    'disabled': false,
                    'id': 'pid',
                    'name': 'pname',
                },
                headerJson: {
                    '_kind': 'Header',
                    'key': 'headerKey',
                    'value': 'headerValue',
                    'id': '',
                    'name': '',
                    'type': '',
                },
            },
        },
        {
            name: 'insomnia.request manipulation',
            preReqScript: `
                const { Header } = require('insomnia-collection');
                insomnia.request.method = 'GET';
                insomnia.request.url.addQueryParams('k1=v1');
                insomnia.request.headers.add(new Header({
                    key: 'Content-Type',
                    value: 'text/plain'
                }));
                insomnia.request.headers.add(new Header({
                    key: 'X-Hello',
                    value: 'hello'
                }));
                insomnia.request.body.update({
                    mode: 'raw',
                    raw: 'rawContent',
                });
            `,
            body: '{}',
            customVerify: (bodyJson: any) => {
                expect(bodyJson.method).toEqual('GET');
                expect(bodyJson.headers['x-hello']).toEqual('hello');
                expect(bodyJson.data).toEqual('rawContent');
            },
        },
        {
            name: 'sendRequest every content type',
            preReqScript: `
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
            `,
            body: '{ "rawBody": {{ _.rawBody }}, "urlencodedBody": {{ _.urlencodedBody }}, "gqlBody": {{ _.gqlBody }}, "fileBody": {{ _.fileBody }}, "formdataBody": {{ _.formdataBody }} }',
            customVerify: (bodyJson: any) => {
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
            },
        },
        {
            name: 'insomnia.request auth manipulation (bearer)',
            preReqScript: `
                insomnia.request.auth.update(
                    {
                        type: 'bearer',
                        bearer: [
                                {key: 'token', value: 'tokenValue'},
                                {key: 'prefix', value: 'CustomTokenPrefix'},
                        ],
                    },
                    'bearer'
                );
            `,
            body: '{}',
            customVerify: (bodyJson: any) => {
                const authzHeader = bodyJson.headers['authorization'];
                expect(authzHeader != null).toBeTruthy();
                expect(bodyJson.headers['authorization']).toEqual('CustomTokenPrefix tokenValue');
            },
        },
        {
            name: 'insomnia.request auth manipulation (basic)',
            preReqScript: `
                insomnia.request.auth.update(
                    {
                        type: 'basic',
                        basic: [
                                {key: 'username', value: 'myName'},
                                {key: 'password', value: 'myPwd'},
                        ],
                    },
                    'basic'
                );
            `,
            body: '{}',
            customVerify: (bodyJson: any) => {
                const authzHeader = bodyJson.headers['authorization'];
                expect(authzHeader != null).toBeTruthy();
                const expectedEncCred = Buffer.from('myName:myPwd', 'utf-8').toString('base64');
                expect(bodyJson.headers['authorization']).toEqual(`Basic ${expectedEncCred}`);
            },
        },
    ];

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];

        test(tc.name, async ({ page }) => {
            const statusTag = page.locator('[data-testid="response-status-tag"]:visible');
            const responseBody = page.getByTestId('response-pane').getByTestId('CodeEditor').locator('.CodeMirror-line');

            await page.getByLabel('Request Collection').getByTestId('echo pre-request script result').press('Enter');

            // set request body
            await page.getByRole('tab', { name: 'Body' }).click();
            await page.getByRole('button', { name: 'Body' }).click();
            await page.getByRole('menuitem', { name: 'JSON' }).click();

            const bodyEditor = page.getByTestId('CodeEditor').getByRole('textbox');
            await bodyEditor.fill(tc.body);

            // enter script
            const preRequestScriptTab = page.getByRole('tab', { name: 'Pre-request Script' });
            await preRequestScriptTab.click();
            const preRequestScriptEditor = page.getByTestId('CodeEditor').getByRole('textbox');
            await preRequestScriptEditor.fill(tc.preReqScript);

            // TODO: wait for body and pre-request script are persisted to the disk
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
            if (tc.expectedBody) {
                expect(JSON.parse(bodyJson.data)).toEqual(tc.expectedBody);
            }
            if (tc.customVerify) {
                tc.customVerify(bodyJson);
            }
        });
    }

    test('insomnia.request / update proxy configuration', async ({ page }) => {
        const responsePane = page.getByTestId('response-pane');

        // update proxy configuration
        await page.locator('[data-testid="settings-button"]').click();
        await page.locator('text=Insomnia Preferences').first().click();
        await page.locator('text=Enable proxy').click();
        await page.locator('[name="httpProxy"]').fill('localhost:1111');
        await page.locator('[name="httpsProxy"]').fill('localhost:2222');
        await page.locator('[name="noProxy"]').fill('http://a.com,https://b.com');
        await page.locator('.app').press('Escape');

        await page.getByLabel('Request Collection').getByTestId('test proxies manipulation').press('Enter');

        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();

        // verify
        await page.getByRole('tab', { name: 'Timeline' }).click();
        await expect(responsePane).toContainText('localhost:2222'); // original proxy
        await expect(responsePane).toContainText('Trying 127.0.0.1:8888'); // updated proxy
    });

    test('insomnia.request / update clientCertificate', async ({ page }) => {
        const responsePane = page.getByTestId('response-pane');
        const fixturePath = getFixturePath('certificates');

        // update proxy configuration
        await page.locator('text=Add Certificates').click();
        await page.locator('text=Add client certificate').click();
        await page.locator('[name="host"]').fill('a.com');
        await page.locator('[data-key="pfx"]').click();

        const fileChooserPromise = page.waitForEvent('filechooser');
        await page.locator('text=Add PFX or PKCS12 file').click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(path.join(fixturePath, 'fake.pfx'));
        await page.getByRole('button', { name: 'Add certificate' }).click();
        await page.getByRole('button', { name: 'Done' }).click();

        await page.getByLabel('Request Collection').getByTestId('test certificate manipulation').press('Enter');

        // TODO: wait for body and pre-request script are persisted to the disk
        // should improve this part, we should avoid sync this state through db as it introduces race condition
        await page.waitForTimeout(500);
        // send
        await page.getByTestId('request-pane').getByRole('button', { name: 'Send' }).click();
        // verify
        await page.getByRole('tab', { name: 'Timeline' }).click();
        await expect(responsePane).toContainText('fixtures/certificates/fake.pfx'); // original proxy
    });
});
