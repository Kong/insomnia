import { expect } from '@playwright/test';
import { ScriptError } from 'insomnia/src/ui/window-message-handlers';

import { test } from '../../playwright/test';

async function waitForTrue(timeout: number, func: () => Promise<boolean>) {
  const pollInterval = 500;

  for (let i = 0; i < timeout / pollInterval; i++) {
    const ready = await func();

    if (ready) {
      break;
    } else {
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
}

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
      let localStorage;

      await waitForTrue(60000, async () => {
        localStorage = await mainWindow?.evaluate(() => window.localStorage);
        expect(localStorage).toBeDefined();

        return localStorage[`test_result:${tc.id}`] || localStorage[`test_error:${tc.id}`];
      });

      expect(localStorage).toBeDefined(); // or no output is found

      if (localStorage) { // just for suppressing ts complaint
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
