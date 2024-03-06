import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
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
                // folder version will override the following wone
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
                insomnia.request.auth.update(
                    {
                        type: 'bearer',
                        bearer: [
                                {key: 'token', value: 'tokenValue'},
                        ],
                    },
                    'bearer'
                );
                // insomnia.request.proxy.update({}); // TODO: enable proxy and test it
                // insomnia.request.certificate.update({});
            `,
            body: '{}',
            customVerify: (bodyJson: any) => {
                expect(bodyJson.method).toEqual('GET');
                expect(bodyJson.headers['x-hello']).toEqual('hello');
                expect(bodyJson.data).toEqual('rawContent');
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
});
