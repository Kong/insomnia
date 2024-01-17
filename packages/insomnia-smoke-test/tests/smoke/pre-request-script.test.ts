import { expect } from '@playwright/test';
import { ScriptError } from 'insomnia/src/ui/window-message-handlers';

import { test } from '../../playwright/test';

async function runTests(testCases: {
  id: string;
  code: string;
  context: object;
  expectedResult: any;
}[]) {
  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];

    // tests begin here
    test(tc.id, async ({ page: mainWindow }) => {
      test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

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
    });
  }
}

test.describe('pre-request script cases', async () => {
  const testCases = [
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
    },
  ];

  await runTests(testCases);
});
