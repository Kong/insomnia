import { expect, Page } from '@playwright/test';
import { ScriptError } from 'insomnia/src/ui/window-message-handlers';

import { test } from '../../playwright/test';

async function runTests(
  mainWindow: Page,
  tc: {
    id: string;
    code: string;
    context: object;
    expectedResult: any;
  }) {
  // start the sandbox
  await mainWindow?.evaluate(
    async () => {
      // it suppresses the type checking error
      const caller = window as unknown as { hiddenBrowserWindow: { start: () => void } };
      if (caller.hiddenBrowserWindow) {
        caller.hiddenBrowserWindow.start();
      }
    },
  );

  // execute the command
  await mainWindow?.evaluate(
    async (tc: any) => {
      window.postMessage(
        {
          action: 'message-event://hidden.browser-window/debug',
          id: tc.id,
          code: tc.code,
          context: tc.context,
        },
        '*',
      );
    },
    tc,
  );

  // verify
  await mainWindow.waitForFunction(
    args => {
      return window.localStorage[args.resultKey] != null || window.localStorage[args.errorKey] != null;
    },
    {
      resultKey: `test_result:${tc.id}`,
      errorKey: `test_error:${tc.id}`,
    }
  );

  const localStorage = await mainWindow?.evaluate(() => window.localStorage);
  expect(localStorage).toBeDefined(); // or no output is found

  const result = localStorage[`test_result:${tc.id}`];
  const error = localStorage[`test_error:${tc.id}`];

  if (result) {
    expect(JSON.parse(result)).toEqual(tc.expectedResult);
  } else {
    const scriptError = JSON.parse(error) as ScriptError;
    expect(scriptError.message).toEqual(tc.expectedResult.message);
  // TODO: stack field is not checked as its content is complex
  }
}

test.describe('pre-request script cases', async () => {
  test('js can be executed and return', async ({ page: mainWindow }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    await runTests(
      mainWindow,
      {
        id: 'run js code and return empty object',
        code: `
            console.log('hello world');
          `,
        context: {
          insomnia: {},
        },
        expectedResult: {
        },
      }
    );
  });

  test('js can throw and get error', async ({ page: mainWindow }) => {
    test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

    await runTests(
      mainWindow,
      {
        id: 'custom error is returned',
        code: `
          throw Error('my custom error');
          `,
        context: {
          insomnia: {},
        },
        expectedResult: {
          message: 'my custom error',
        },
      },
    );
  });
});
