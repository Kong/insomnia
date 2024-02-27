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
            name: 'send environment-populated request',
            preReqScript: `
                insomnia.environment.set('fromEnv1', 'env1');
            `,
            body: `{
                "fromEnv1": "{{ _.fromEnv1 }}"
            }`,
            expectedBody: {
                fromEnv1: 'env1',
            },
        },
        {
            name: 'send environment-overridden request',
            preReqScript: `
                // 'predefined' is already defined in the base environment, its original value is 'base'
                insomnia.environment.set('predefined', 'updatedByScript');
            `,
            body: `{
                "predefined": "{{ _.predefined }}"
            }`,
            expectedBody: {
                predefined: 'updatedByScript',
            },
        },
        {
            name: 'environments / populate environments',
            preReqScript: `
                insomnia.baseEnvironment.set('fromBaseEnv', 'baseEnv');
            `,
            body: `{
                "fromBaseEnv": "{{ _.fromBaseEnv }}"
            }`,
            expectedBody: {
                fromBaseEnv: 'baseEnv',
            },
        },
        {
            name: 'environments / override base environments',
            preReqScript: `
                insomnia.baseEnvironment.set('scriptValue', 'fromBase');
                insomnia.environment.set('scriptValue', 'fromEnv');
            `,
            body: `{
                "scriptValue": "{{ _.scriptValue }}"
            }`,
            expectedBody: {
                scriptValue: 'fromEnv',
            },
        },
        {
            name: 'environments / override predefined base environment in script',
            preReqScript: `
                // "preDefinedValue" is already defined in the base environment modal.
                // but it is rewritten here
                insomnia.baseEnvironment.set('preDefinedValue', 'fromScript');
            `,
            body: `{
                "preDefinedValue": "{{ _.preDefinedValue }}"
            }`,
            expectedBody: {
                preDefinedValue: 'fromScript',
            },
        },
        {
            name: 'environments / envrionment from script should be overidden by folder environment',
            preReqScript: `
                // "customValue" is already defined in the folder environment.
                // folder version will override the following wone
                insomnia.baseEnvironment.set('customValue', 'fromScript');
            `,
            body: `{
                "customValue": "{{ _.customValue }}"
            }`,
            expectedBody: {
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
