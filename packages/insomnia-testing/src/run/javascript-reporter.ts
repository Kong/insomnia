/**
 * NOTE: This is a straight copy of the default Mocha JSON reporter, except stdout logging is removed.
 *
 * https://github.com/mochajs/mocha/blob/9d4a8ec2d22ee154aecb1f8eeb25af8e6309faa8/lib/reporters/json.js
 */
import Mocha, { MochaOptions, Runner, Test, reporters, Runnable } from 'mocha';
import { TestResult, TestResults } from './entities';

export class JavaScriptReporter extends reporters.Base {
  description = 'single JS object';

  constructor(runner: Runner & { testResults?: TestResults }, options: MochaOptions) {
    super(runner, options);

    Mocha.reporters.Base.call(this, runner, options);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const tests: Test[] = [];
    const pending: Test[] = [];
    const failures: Test[] = [];
    const passes: Test[] = [];

    runner.on(Mocha.Runner.constants.EVENT_TEST_END, test => {
      tests.push(test);
    });

    runner.on(Mocha.Runner.constants.EVENT_TEST_PASS, test => {
      passes.push(test);
    });

    runner.on(Mocha.Runner.constants.EVENT_TEST_FAIL, test => {
      failures.push(test);
    });

    runner.on(Mocha.Runner.constants.EVENT_TEST_PENDING, test => {
      pending.push(test);
    });

    runner.once(Mocha.Runner.constants.EVENT_RUN_END, () => {
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
}

/**
 * Return a plain-object representation of `test` free of cyclic properties etc.
 */
const clean = (runnable: Runnable): TestResult => {
  // @ts-expect-error this is what the source code originally had in mocha so I am not changing it
  let err = runnable.err || {};
  if (err instanceof Error) {
    err = errorJSON(err);
  }

  return {
    title: runnable.title,
    fullTitle: runnable.fullTitle(),
    file: runnable.file,
    duration: runnable.duration,
    // @ts-expect-error this is what the source code originally had in mocha so I am not changing it
    currentRetry: runnable.currentRetry(),
    err: cleanCycles(err),
  };
};

/**
 * Replaces any circular references inside `obj` with '[object Object]'
 */
const cleanCycles = (obj: Error) => {
  const cache: JSON[] = [];
  return JSON.parse(
    JSON.stringify(obj, (_, value) => {
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
};

/**
 * Transform an Error object into a JSON object.
 */
const errorJSON = (error: Error) => {
  return (Object.getOwnPropertyNames(error) as (keyof Error)[]).reduce((accumulator, key) => {
    return {
      ...accumulator,
      [key]: error[key],
    };
  }, {});
};
