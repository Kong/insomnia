import { expect } from '@playwright/test';

import { test } from '../../playwright/test';;

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

test.describe('test pre-request script execution', async () => {

  const testCases = [
    {
      id: 'environment basic operations',
      code: `
            const bool2 = pm.environment.has('bool1');
            const num2 = pm.environment.get('num1');
            const str2 = pm.environment.get('str1');
            // add & update
            pm.environment.set('bool1', false);
            pm.environment.set('num1', 11);
            pm.environment.set('str1', 'strr');
            pm.environment.set('bool2', bool2);
            pm.environment.set('num2', num2);
            pm.environment.set('str2', str2);
            // toObject
            const newObject = pm.environment.toObject();
            pm.environment.set('newObject.bool', newObject.bool2);
            pm.environment.set('newObject.num', newObject.num2);
            pm.environment.set('newObject.str', newObject.str2);
            // unset
            pm.environment.set('willDelete', 11);
            pm.environment.unset('willDelete');
            // render
            const vals = pm.environment.replaceIn('{{bool1}}-{{num1}}-{{str1}}');
            pm.environment.set('rendered', vals);
          `,
      context: {
        insomnia: {
          environment: {
            bool1: true,
            num1: 1,
            str1: 'str',
          },
        },
      },
      expectedResult: {
        collectionVariables: {},
        iterationData: {},
        globals: {},
        variables: {
          bool1: false,
          num1: 11,
          str1: 'strr',
          bool2: true,
          num2: 1,
          str2: 'str',
          'newObject.bool': true,
          'newObject.num': 1,
          'newObject.str': 'str',
          'rendered': 'false-11-strr',
        },
        environment: {
          bool1: false,
          num1: 11,
          str1: 'strr',
          bool2: true,
          num2: 1,
          str2: 'str',
          'newObject.bool': true,
          'newObject.num': 1,
          'newObject.str': 'str',
          'rendered': 'false-11-strr',
        },
        info: {
          'eventName': 'prerequest',
          'iteration': 1,
          'iterationCount': 1,
          'requestId': '',
          'requestName': '',
        },
      },
    },
    {
      id: 'collectionVariables (baseEnvironment) basic operations',
      code: `
            const bool2 = pm.collectionVariables.has('bool1');
            const num2 = pm.collectionVariables.get('num1');
            const str2 = pm.collectionVariables.get('str1');
            // add & update
            pm.collectionVariables.set('bool1', false);
            pm.collectionVariables.set('num1', 11);
            pm.collectionVariables.set('str1', 'strr');
            pm.collectionVariables.set('bool2', bool2);
            pm.collectionVariables.set('num2', num2);
            pm.collectionVariables.set('str2', str2);
            // toObject
            const newObject = pm.collectionVariables.toObject();
            pm.collectionVariables.set('newObject.bool', newObject.bool2);
            pm.collectionVariables.set('newObject.num', newObject.num2);
            pm.collectionVariables.set('newObject.str', newObject.str2);
            // unset
            pm.collectionVariables.set('willDelete', 11);
            pm.collectionVariables.unset('willDelete');
            // render
            const vals = pm.collectionVariables.replaceIn('{{bool1}}-{{num1}}-{{str1}}');
            pm.collectionVariables.set('rendered', vals);
          `,
      context: {
        insomnia: {
          collectionVariables: {
            bool1: true,
            num1: 1,
            str1: 'str',
          },
        },
      },
      expectedResult: {
        environment: {},
        variables: {
          'bool1': false,
          'bool2': true,
          'newObject.bool': true,
          'newObject.num': 1,
          'newObject.str': 'str',
          'num1': 11,
          'num2': 1,
          'rendered': 'false-11-strr',
          'str1': 'strr',
          'str2': 'str',
        },
        globals: {},
        iterationData: {},
        collectionVariables: {
          bool1: false,
          num1: 11,
          str1: 'strr',
          bool2: true,
          num2: 1,
          str2: 'str',
          'newObject.bool': true,
          'newObject.num': 1,
          'newObject.str': 'str',
          'rendered': 'false-11-strr',
        },
        info: {
          'eventName': 'prerequest',
          'iteration': 1,
          'iterationCount': 1,
          'requestId': '',
          'requestName': '',
        },
      },
    },
    {
      id: 'variables basic operations',
      code: `
            const unexisting = pm.variables.has('VarNotExist');
            const strFromGlobal = pm.variables.get('glb');
            const strFromCollection = pm.variables.get('col');
            const numFromEnv = pm.variables.get('num');
            const strFromIter = pm.variables.get('str');
            const rendered = pm.variables.replaceIn('{{bool}}-{{num}}-{{str}}');
            // set local
            pm.variables.set('strFromGlobal', strFromGlobal);
            pm.variables.set('strFromCollection', strFromCollection);
            pm.variables.set('numFromEnv', numFromEnv);
            pm.variables.set('strFromIter', strFromIter);
            pm.variables.set('rendered', rendered);
          `,
      context: {
        insomnia: {
          globals: {
            bool: false,
            num: 1,
            glb: 'glb',
          },
          collectionVariables: {
            num: 2,
            col: 'col',
          },
          environment: {
            num: 3,
            str: 'env',
          },
          iterationData: {
            str: 'iter',
          },
        },
      },
      expectedResult: {
        globals: {
          bool: false,
          num: 1,
          glb: 'glb',
        },
        collectionVariables: {
          num: 2,
          col: 'col',
        },
        environment: {
          num: 3,
          str: 'env',
        },
        iterationData: {
          str: 'iter',
        },
        variables: {
          strFromGlobal: 'glb',
          strFromCollection: 'col',
          numFromEnv: 3,
          strFromIter: 'iter',
          rendered: 'false-3-iter',
          bool: false,
          col: 'col',
          glb: 'glb',
          num: 3,
          'str': 'iter',
        },
        info: {
          eventName: 'prerequest',
          iteration: 1,
          iterationCount: 1,
          requestId: '',
          requestName: '',
        },
      },
      info: {
        'eventName': 'prerequest',
        'iteration': 1,
        'iterationCount': 1,
        'requestId': '',
        'requestName': '',
      },
    },
    {
      id: 'requestInfo tests',
      code: `
        const eventName = pm.info.eventName;
        const iteration = pm.info.iteration;
        const iterationCount = pm.info.iterationCount;
        const requestName = pm.info.requestName;
        const requestId = pm.info.requestId;
        `,
      context: {
        insomnia: {
          requestInfo: {
            eventName: 'prerequest',
            iteration: 1,
            iterationCount: 1,
            requestName: 'req',
            requestId: 'req-1',
          },
        },
      },
      expectedResult: {
        globals: {},
        iterationData: {},
        variables: {},
        environment: {},
        collectionVariables: {},
        info: {
          eventName: 'prerequest',
          iteration: 1,
          iterationCount: 1,
          requestName: 'req',
          requestId: 'req-1',
        },
      },
    },
    {
      id: 'execution timeout (default timeout 3s)',
      code: `
        await new Promise(resolve => setTimeout(resolve, 4000));
        `,
      context: {
        insomnia: {},
      },
      expectedResult: {
        message: 'executing script timeout:3000ms',
      },
    },
    {
      id: 'invalid result is returned',
      code: `
        resolve();
        `,
      context: {
        insomnia: {},
      },
      expectedResult: {
        message: 'result is invalid, probably custom value is returned',
      },
    },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];

    // tests begin here
    test(tc.id, async ({ app, page: mainWindow }) => {
      test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

      const originalWindowCount = app.windows().length;

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

      // waiting for the hidden browser ready
      await waitForTrue(60000, async () => {
        const windows = app.windows();

        if (windows.length > originalWindowCount) {
          for (const page of windows) {
            if (await page.title() === 'Hidden Browser Window') {
              await page.waitForLoadState();
              return true;
            }
          }
        }

        return false;
      });

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

      if (localStorage) { // just for suppressing ts complaint
        const result = localStorage[`test_result:${tc.id}`];
        const error = localStorage[`test_error:${tc.id}`];

        if (result) {
          expect(JSON.parse(result)).toEqual(tc.expectedResult);
        } else {
          expect(JSON.parse(error)).toEqual(tc.expectedResult);
        }
      }

    });
  }
});
