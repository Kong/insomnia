import { expect } from '@playwright/test';

import { loadFixture } from '../../playwright/paths';
import { test } from '../../playwright/test';;

test.describe('pre-request UI tests', async () => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    test.beforeEach(async ({ app, page }) => {
        const text = await loadFixture('smoke-test-collection.yaml');
        await app.evaluate(async ({ clipboard }, text) => clipboard.writeText(text), text);

        await page.getByRole('button', { name: 'Create in project' }).click();
        await page.getByRole('menuitemradio', { name: 'Import' }).click();
        await page.locator('[data-test-id="import-from-clipboard"]').click();
        await page.getByRole('button', { name: 'Scan' }).click();
        await page.getByRole('dialog').getByRole('button', { name: 'Import' }).click();

        await page.getByText('CollectionSmoke testsjust now').click();
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
            name: 'require / require classes from insomnia-collection module',
            preReqScript: `
            const { Property, Header, Variable } = require('insomnia-collection');
            const prop = new Property('pid', 'pname');
            const header = new Header({ key: 'headerKey', value: 'headerValue' });
            const variable = new Variable({ key: 'headerKey', value: 'headerValue' });
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

            const bodyJson = JSON.parse(rows.join('\n'));
            expect(bodyJson.data).toEqual(tc.expectedBody);
        });
    }
});
