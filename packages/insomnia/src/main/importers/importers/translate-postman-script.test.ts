import { describe, expect, it } from 'vitest';

import { translateHandlersInScript } from './translate-postman-script';

describe('test pm to insomnia translation', () => {
  [
    {
      script: "pm.environment.set('', '')",
      expected: "insomnia.environment.set('', '')",
    },
    {
      script: 'ipm.fn()',
      expected: 'ipm.fn()',
    },
    {
      script: 'h5pm.fn()',
      expected: 'h5pm.fn()',
    },
    {
      script: '$pm.fn()',
      expected: '$pm.fn()',
    },
    {
      script: '_pm.fn()',
      expected: '_pm.fn()',
    },
    {
      script: 'pre-pm.fn()',
      expected: 'pre-pm.fn()',
    },
    {
      script: 'obj.pm.fn()',
      expected: 'obj.pm.fn()',
    },
    {
      script: '"pm".length',
      expected: '"pm".length',
    },
    {
      script: 'call(pm.environment.get("hehe"))',
      expected: 'call(insomnia.environment.get("hehe"))',
    },
    {
      script: 'obj[pm.environment.get("hehe")]',
      expected: 'obj[insomnia.environment.get("hehe")]',
    },
    {
      script: 'if(true) {pm.environment.get("hehe")}',
      expected: 'if(true) {insomnia.environment.get("hehe")}',
    },
    {
      script: `
                console.log(pm.variables.get('score'), pm.variables.get('score2'));
                console.log(pm.collectionVariables.get('score'));
                console.log(pm.environment.get('score'));`,
      expected: `
                console.log(insomnia.variables.get('score'), insomnia.variables.get('score2'));
                console.log(insomnia.collectionVariables.get('score'));
                console.log(insomnia.environment.get('score'));`,
    },
  ].forEach(testCase => {
    it(`translate: ${testCase.script}`, () => {
      expect(translateHandlersInScript(testCase.script)).toBe(testCase.expected);
    });
  });
});

describe('test deprecate rules translation', () => {
  [
    // --- tests ---
    {
      script: "tests['desc'] = variable === 'value';",
      expected: "insomnia.test('desc', function() { insomnia.expect(variable === 'value').to.be.true; });",
    },
    // --- globals ---
    {
      script: "globals.foo = 'bar';",
      expected: "insomnia.globals.set('foo', 'bar');",
    },
    {
      script: "globals['foo'] = 'bar';",
      expected: "insomnia.globals.set('foo', 'bar');",
    },
    {
      script: 'console.log(globals.foo);',
      expected: "console.log(insomnia.globals.get('foo'));",
    },
    {
      script: "console.log(globals['foo']);",
      expected: "console.log(insomnia.globals.get('foo'));",
    },
    // --- environment ---
    {
      script: "environment.foo = 'bar';",
      expected: "insomnia.environment.set('foo', 'bar');",
    },
    {
      script: "environment['foo'] = 'bar';",
      expected: "insomnia.environment.set('foo', 'bar');",
    },
    {
      script: 'console.log(environment.foo);',
      expected: "console.log(insomnia.environment.get('foo'));",
    },
    {
      script: "console.log(environment['foo']);",
      expected: "console.log(insomnia.environment.get('foo'));",
    },
    // --- responseTime ---
    {
      script: 'console.log(responseTime);',
      expected: 'console.log(insomnia.response.responseTime);',
    },
    // --- responseHeaders ---
    {
      script: 'console.log(responseHeaders.header);',
      expected: "console.log(insomnia.response.headers.get('header'));",
    },
    {
      script: "console.log(responseHeaders['header']);",
      expected: "console.log(insomnia.response.headers.get('header'));",
    },
    // --- responseCode ---
    {
      script: 'console.log(responseCode.code);',
      expected: 'console.log(insomnia.response.code);',
    },
    // --- responseBody ---
    {
      script: 'console.log(responseBody);',
      expected: 'console.log(insomnia.response.text());',
    },
    // --- postman ---
    // --- postman - environment ---
    {
      script: "postman.getEnvironmentVariable('var-name')",
      expected: "insomnia.environment.get('var-name')",
    },
    {
      script: "postman.setEnvironmentVariable('var-name', 'value')",
      expected: "insomnia.environment.set('var-name', 'value')",
    },
    {
      script: "postman.clearEnvironmentVariable('var-name')",
      expected: "insomnia.environment.unset('var-name')",
    },
    {
      script: 'postman.clearEnvironmentVariable()',
      expected: 'insomnia.environment.clear()',
    },
    // --- postman - globals ---
    {
      script: "postman.getGlobalVariable('var-name')",
      expected: "insomnia.globals.get('var-name')",
    },
    {
      script: "postman.setGlobalVariable('var-name', 'value')",
      expected: "insomnia.globals.set('var-name', 'value')",
    },
    {
      script: "postman.clearGlobalVariable('var-name')",
      expected: "insomnia.globals.unset('var-name')",
    },
    {
      script: 'postman.clearGlobalVariable()',
      expected: 'insomnia.globals.clear()',
    },
    // --- postman - setNextRequest ---
    {
      script: "postman.setNextRequest('request-name')",
      expected: "insomnia.execution.setNextRequest('request-name')",
    },
    // --- postman - cookie ---
    {
      script: "postman.getResponseCookie('name').value",
      expected: "insomnia.cookies.get('name')",
    },
    // --- postman - response header ---
    {
      script: "postman.getResponseHeader('name')",
      expected: "insomnia.response.headers.get('name')",
    },
  ].forEach(testCase => {
    it(`translate: ${testCase.script}`, () => {
      expect(translateHandlersInScript(testCase.script)).toBe(testCase.expected);
    });
  });
});

describe('comprehensive script translation test', () => {
  it('should translate a complete script with all known transformation rules', () => {
    const completeScript = `
// Test "pm" API translations
pm.environment.set('apiUrl', 'https://api.example.com');
const baseUrl = pm.environment.get('baseUrl');
pm.globals.set('userId', '12345');
const userId = pm.globals.get('userId');
pm.variables.set('token', 'abc123');
const token = pm.variables.get('token');
pm.collectionVariables.set('version', 'v1');
const version = pm.collectionVariables.get('version');

// Test deprecated tests syntax
tests['Status code is 200'] = responseCode.code === 200;
tests['Response time is acceptable'] = responseTime < 1000;

// Test deprecated globals syntax
globals.authToken = 'bearer-token';
globals['requestId'] = 'req-001';
console.log(globals.authToken);
console.log(globals['requestId']);

// Test deprecated environment syntax  
environment.serverUrl = 'http://localhost:3000';
environment['debugMode'] = 'true';
console.log(environment.serverUrl);
console.log(environment['debugMode']);

// Test deprecated response variables
console.log('Response time:', responseTime);
console.log('Response code:', responseCode.code);
console.log('Response body:', responseBody);
console.log('Content-Type header:', responseHeaders['Content-Type']);
console.log('Server header:', responseHeaders.Server);

// Test deprecated postman API
const envVar = postman.getEnvironmentVariable('envVar');
postman.setEnvironmentVariable('newVar', 'newValue');
postman.clearEnvironmentVariable('oldVar');
postman.clearEnvironmentVariable();

const globalVar = postman.getGlobalVariable('globalVar');
postman.setGlobalVariable('newGlobal', 'globalValue');  
postman.clearGlobalVariable('oldGlobal');
postman.clearGlobalVariable();

postman.setNextRequest('Next Request Name');
const cookieValue = postman.getResponseCookie('sessionId').value;
const headerValue = postman.getResponseHeader('X-Custom-Header');

// Test that non-pm identifiers are not translated
ipm.fn();
h5pm.fn();
$pm.fn();
_pm.fn();
obj.pm.fn();
const length = "pm".length;
`;

    const expectedTranslation = `
// Test "pm" API translations
insomnia.environment.set('apiUrl', 'https://api.example.com');
const baseUrl = insomnia.environment.get('baseUrl');
insomnia.globals.set('userId', '12345');
const userId = insomnia.globals.get('userId');
insomnia.variables.set('token', 'abc123');
const token = insomnia.variables.get('token');
insomnia.collectionVariables.set('version', 'v1');
const version = insomnia.collectionVariables.get('version');

// Test deprecated tests syntax
insomnia.test('Status code is 200', function() { insomnia.expect(insomnia.response.code === 200).to.be.true; });
insomnia.test('Response time is acceptable', function() { insomnia.expect(insomnia.response.responseTime < 1000).to.be.true; });

// Test deprecated globals syntax
insomnia.globals.set('authToken', 'bearer-token');
insomnia.globals.set('requestId', 'req-001');
console.log(insomnia.globals.get('authToken'));
console.log(insomnia.globals.get('requestId'));

// Test deprecated environment syntax  
insomnia.environment.set('serverUrl', 'http://localhost:3000');
insomnia.environment.set('debugMode', 'true');
console.log(insomnia.environment.get('serverUrl'));
console.log(insomnia.environment.get('debugMode'));

// Test deprecated response variables
console.log('Response time:', insomnia.response.responseTime);
console.log('Response code:', insomnia.response.code);
console.log('Response body:', insomnia.response.text());
console.log('Content-Type header:', insomnia.response.headers.get('Content-Type'));
console.log('Server header:', insomnia.response.headers.get('Server'));

// Test deprecated postman API
const envVar = insomnia.environment.get('envVar');
insomnia.environment.set('newVar', 'newValue');
insomnia.environment.unset('oldVar');
insomnia.environment.clear();

const globalVar = insomnia.globals.get('globalVar');
insomnia.globals.set('newGlobal', 'globalValue');  
insomnia.globals.unset('oldGlobal');
insomnia.globals.clear();

insomnia.execution.setNextRequest('Next Request Name');
const cookieValue = insomnia.cookies.get('sessionId');
const headerValue = insomnia.response.headers.get('X-Custom-Header');

// Test that non-pm identifiers are not translated
ipm.fn();
h5pm.fn();
$pm.fn();
_pm.fn();
obj.pm.fn();
const length = "pm".length;
`;

    expect(translateHandlersInScript(completeScript)).toBe(expectedTranslation);
  });
});
