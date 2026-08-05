export interface TransformRule {
  pattern: RegExp;
  replacement: string;
}

/**
 * (?<![\.\$\-"'])\b used to check the variable name is not part of other identifiers,
 * e.g. `upm`, `m-pm`, `my.pm`, `c_pm`, `"pm"`, `'pm'`.
 * !But some known cases like `µpm` cannot be covered.
 */

/**
 * !Doesn't support:
 *  - request
 *  - data
 * !Please keep the order, otherwise the get translation may break the set translations
 */
const DEFAULT_PREPROCESS_RULES: TransformRule[] = [
  // From: tests['desc'] = variable === 'value';
  // To: pm.test('desc', function() { pm.expect(variable === 'value').to.be.true; });
  // !Doesn't support:
  //  - tests.desc = variable === 'value';
  //  - expression without `;`
  {
    pattern: /(?<![\.\$\-"'])\btests\[(.*?)\]\s*=\s*(.*?);/g,
    replacement: 'pm.test($1, function() { pm.expect($2).to.be.true; });',
  },
  // --- globals ---
  // From: globals.foo = 'bar';
  // To: pm.globals.set('foo', 'bar');
  // !Doesn't support: `Object.keys(globals)`, `'env' in globals`
  // !Inconsistency: after `global.variable = 'value'`, global.variable is changed in the runtime but not changed in the storage.
  {
    pattern: /(?<![\.\$\-"'])\bglobals\.(.+?)\s*=\s*(.*?);/g,
    replacement: "pm.globals.set('$1', $2);",
  },
  // From: globals['foo'] = 'bar';
  // To: pm.globals.set('foo', 'bar');
  {
    pattern: /(?<![\.\$\-"'])\bglobals\[(.+?)\]\s*=\s*(.*?);/g,
    replacement: 'pm.globals.set($1, $2);',
  },
  // From: globals.foo
  // To: pm.globals.get('foo')
  {
    pattern: /(?<![\.\$\-"'])\bglobals\.(.+?)\b/g,
    replacement: "pm.globals.get('$1')",
  },
  // From: globals['foo']
  // To: pm.globals.get('foo')
  {
    pattern: /(?<![\.\$\-"'])\bglobals\[(.+?)\]/g,
    replacement: 'pm.globals.get($1)',
  },
  // --- environment ---
  // !Doesn't support: `Object.keys(environment)`, `'env' in environment`
  // !Inconsistency: after `environment.variable = 'value'`, environment.variable is changed in the runtime but not changed in the storage.
  // From: environment.foo = 'bar';
  // To: pm.environment.set('foo', 'bar');
  {
    pattern: /(?<![\.\$\-"'])\benvironment\.(.+?)\s*=\s*(.*?);/g,
    replacement: "pm.environment.set('$1', $2);",
  },
  // From: environment['foo'] = 'bar';
  // To: pm.environment.set('foo', 'bar');
  {
    pattern: /(?<![\.\$\-"'])\benvironment\[(.+?)\]\s*=\s*(.*?);/g,
    replacement: 'pm.environment.set($1, $2);',
  },
  // From: environment.foo
  // To: pm.environment.get('foo')
  {
    pattern: /(?<![\.\$\-"'])\benvironment\.(.+?)\b/g,
    replacement: "pm.environment.get('$1')",
  },
  // From: environment['foo']
  // To: pm.environment.get('foo')
  {
    pattern: /(?<![\.\$\-"'])\benvironment\[(.+?)\]/g,
    replacement: 'pm.environment.get($1)',
  },
  // --- responseTime ---
  // From: responseTime
  // To: pm.response.responseTime
  {
    pattern: /(?<![$.])\bresponseTime\b(?!\$)/g,
    replacement: 'pm.response.responseTime',
  },
  // --- responseHeaders ---
  // From: responseHeaders.header
  // To: pm.response.headers.get('header')
  {
    pattern: /(?<![\.\$\-"'])\bresponseHeaders\.(.+?)\b/g,
    replacement: "pm.response.headers.get('$1')",
  },
  // From: responseHeaders['header']
  // To: pm.response.headers.get('header')
  {
    pattern: /(?<![\.\$\-"'])\bresponseHeaders\[(.+?)\]/g,
    replacement: 'pm.response.headers.get($1)',
  },
  // --- responseCode ---
  // From: responseCode.code
  // To: pm.response.code
  {
    pattern: /(?<![\.\$\-"'])\bresponseCode\.code\b(?!\$)/g,
    replacement: 'pm.response.code',
  },
  // --- responseBody ---
  // From: responseBody
  // To: pm.response.text()
  {
    pattern: /(?<![$.])\bresponseBody\b(?!\$)/g,
    replacement: 'pm.response.text()',
  },
  // --- postman ---
  // --- postman - environment ---
  // From: postman.getEnvironmentVariable('var-name')
  // To: pm.environment.get('var-name')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.getEnvironmentVariable\((.*?)\)/g,
    replacement: 'pm.environment.get($1)',
  },
  // From: postman.setEnvironmentVariable('var-name', 'value')
  // To: pm.environment.set('var-name', 'value')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.setEnvironmentVariable\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/g,
    replacement: 'pm.environment.set($1, $2)',
  },
  // From: postman.clearEnvironmentVariable('var-name')
  // To: pm.environment.unset('var-name')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.clearEnvironmentVariable\s*\(\s*(.+?)\s*\)/g,
    replacement: 'pm.environment.unset($1)',
  },
  // From: postman.clearEnvironmentVariable()
  // To: pm.environment.clear()
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.clearEnvironmentVariable\s*\(\s*\)/g,
    replacement: 'pm.environment.clear()',
  },
  // --- postman - globals ---
  // From: postman.getGlobalVariable('var-name')
  // To: pm.globals.get('var-name')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.getGlobalVariable\((.*?)\)/g,
    replacement: 'pm.globals.get($1)',
  },
  // From: postman.setGlobalVariable('var-name', 'value')
  // To: pm.globals.set('var-name', 'value')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.setGlobalVariable\s*\(\s*(.+?)\s*,\s*(.+?)\s*\)/g,
    replacement: 'pm.globals.set($1, $2)',
  },
  // From: postman.clearGlobalVariable('var-name')
  // To: pm.globals.unset('var-name')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.clearGlobalVariable\s*\(\s*(.+?)\s*\)/g,
    replacement: 'pm.globals.unset($1)',
  },
  // From: postman.clearGlobalVariable()
  // To: pm.globals.clear()
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.clearGlobalVariable\s*\(\s*\)/g,
    replacement: 'pm.globals.clear()',
  },
  // --- postman - setNextRequest ---
  // From: postman.setNextRequest
  // To: pm.execution.setNextRequest
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.setNextRequest\b/g,
    replacement: 'pm.execution.setNextRequest',
  },
  // --- postman - cookie ---
  // From: postman.getResponseCookie('name').value
  // To: pm.cookies.get('name')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.getResponseCookie\((.*?)\)\.value/g,
    replacement: 'pm.cookies.get($1)',
  },
  // --- postman - response header ---
  // From: postman.getResponseHeader('name')
  // To: pm.response.headers.get('name')
  {
    pattern: /(?<![\.\$\-"'])\bpostman\.getResponseHeader\((.*?)\)/g,
    replacement: 'pm.response.headers.get($1)',
  },
];

export const translateHandlersInScript = (scriptContent: string) => {
  let translated = scriptContent;

  // Combine standard rules with experimental rules if flag is set
  const rules = DEFAULT_PREPROCESS_RULES;

  for (const rule of rules) {
    try {
      translated = translated.replaceAll(rule.pattern, rule.replacement);
    } catch (error) {
      console.warn(`Failed to apply postprocess rule "${rule.pattern}":`, error);
    }
  }

  // Replace `pm.` to `insomnia.`. Doesn't support `µpm`.
  translated = translated.replace(/(?<![\.\$\-"'])\bpm\./g, 'insomnia.');

  return translated;
};
