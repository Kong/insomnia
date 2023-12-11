import { expect } from '@playwright/test';

import { test } from '../../playwright/test';;

test.describe('test utility process', async () => {

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
        pm: {
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
        pm: {
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
        pm: {
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
      },
    },
    {
      id: 'simple test sendRequest and await/async',
      code: `
          let testResp;
          try {
            await new Promise(
              resolve => {
                pm.sendRequest(
                  'http://127.0.0.1:4010/pets/1',
                  (err, resp) => {
                    testResp = resp;
                    resolve();
                  }
                );
              }
            );
          } catch (e) {
            pm.variables.set('error', e);
          }
          pm.variables.set('resp.code', testResp.code);
        `,
      context: {
        pm: {},
      },
      expectedResult: {
        globals: {},
        iterationData: {},
        variables: {
          'resp.code': 200,
        },
        environment: {},
        collectionVariables: {},
      },
    },
  ];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];

    // tests begin here
    test(tc.id, async ({ page: mainWindow }) => {
      test.slow(process.platform === 'darwin' || process.platform === 'win32', 'Slow app start on these platforms');

      // action
      await mainWindow?.evaluate(
        async (tc: any) => {
          window.postMessage(
            {
              action: 'message-event://utility.process/debug',
              id: tc.id,
              code: tc.code,
              context: tc.context,
            },
            '*',
          );
        },
        tc,
      );

      // assert
      let localStorage;

      // TODO: ideally call waitForEvent
      for (let i = 0; i < 120; i++) {
        localStorage = await mainWindow?.evaluate(() => window.localStorage);
        expect(localStorage).toBeDefined();

        if (localStorage[`test_result:${tc.id}`] || localStorage[`test_error:${tc.id}`]) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (localStorage) { // just for suppressing ts complaint
        console.log(localStorage[`test_result:${tc.id}`], localStorage[`test_result:${tc.id}`]);
        expect(JSON.parse(localStorage[`test_result:${tc.id}`])).toEqual(tc.expectedResult);
      }

    });

  }
});
