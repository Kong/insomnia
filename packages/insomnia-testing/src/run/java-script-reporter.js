/**
 * NOTE: This is a straight copy of the default Mocha JSON reporter, except
 * stdout logging is removed.
 *
 * https://github.com/mochajs/mocha/blob/9d4a8ec2d22ee154aecb1f8eeb25af8e6309faa8/lib/reporters/json.js
 */
import Mocha from 'mocha';

export function JavaScriptReporter(runner, options) {
  Mocha.reporters.Base.call(this, runner, options);

  const self = this;
  const tests = [];
  const pending = [];
  const failures = [];
  const passes = [];

  runner.on(Mocha.Runner.constants.EVENT_TEST_END, function(test) {
    tests.push(test);
  });

  runner.on(Mocha.Runner.constants.EVENT_TEST_PASS, function(test) {
    passes.push(test);
  });

  runner.on(Mocha.Runner.constants.EVENT_TEST_FAIL, function(test) {
    failures.push(test);
  });

  runner.on(Mocha.Runner.constants.EVENT_TEST_PENDING, function(test) {
    pending.push(test);
  });

  runner.once(Mocha.Runner.constants.EVENT_RUN_END, function() {
    runner.testResults = {
      stats: self.stats,
      tests: tests.map(clean),
      pending: pending.map(clean),
      failures: failures.map(clean),
      passes: passes.map(clean),
    };

    // This is the main change from the original JSONReporter
    // process.stdout.write(JSON.stringify(obj, null, 2));
  });
}

/**
 * Return a plain-object representation of `test`
 * free of cyclic properties etc.
 *
 * @private
 * @param {Object} test
 * @return {Object}
 */
function clean(test) {
  let err = test.err || {};
  if (err instanceof Error) {
    err = errorJSON(err);
  }

  return {
    title: test.title,
    fullTitle: test.fullTitle(),
    file: test.file,
    duration: test.duration,
    currentRetry: test.currentRetry(),
    err: cleanCycles(err),
  };
}

/**
 * Replaces any circular references inside `obj` with '[object Object]'
 *
 * @private
 * @param {Object} obj
 * @return {Object}
 */
function cleanCycles(obj) {
  const cache = [];
  return JSON.parse(
    JSON.stringify(obj, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
          // Instead of going in a circle, we'll print [object Object]
          return '' + value;
        }
        cache.push(value);
      }

      return value;
    }),
  );
}

/**
 * Transform an Error object into a JSON object.
 *
 * @private
 * @param {Error} err
 * @return {Object}
 */
function errorJSON(err) {
  const res = {};
  Object.getOwnPropertyNames(err).forEach(function(key) {
    res[key] = err[key];
  }, err);
  return res;
}

JavaScriptReporter.description = 'single JS object';
