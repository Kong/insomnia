import { hashStringToHex } from '~/utils/hash-string';

/** @ignore */
export async function test(msg: string, fn: () => Promise<void>, log: (testResult: RequestTestResult) => void) {
  const wrapFn = async () => {
    const started = performance.now();

    try {
      await fn();

      const executionTime = performance.now() - started;
      log({
        key: await hashStringToHex(`${msg}-passed`),
        testCase: msg,
        status: 'passed',
        executionTime,
        category: 'unknown',
      });
    } catch (e) {
      const executionTime = performance.now() - started;
      log({
        key: await hashStringToHex(`${msg}-failed`),
        testCase: msg,
        status: 'failed',
        executionTime,
        errorMessage: `error: ${e} | ACTUAL: ${e.actual} | EXPECTED: ${e.expected}`,
        category: 'unknown',
      });
    }
  };

  const testPromise = wrapFn();
  startTestObserver(testPromise);
  return testPromise;
}

let testPromises = new Array<Promise<void>>();
/** ignore */
export async function waitForAllTestsDone() {
  await Promise.allSettled(testPromises);
  testPromises = [];
}
function startTestObserver(promise: Promise<void>) {
  testPromises.push(promise);
}

/** ignore */
export async function skip(msg: string, _: () => Promise<void>, log: (testResult: RequestTestResult) => void) {
  log({
    key: await hashStringToHex(`${msg}-skipped`, 'SHA-1'),
    testCase: msg,
    status: 'skipped',
    executionTime: 0,
    category: 'unknown',
  });
}

/** ignore */
export type TestStatus = 'passed' | 'failed' | 'skipped';
/** ignore */
export type TestCategory = 'unknown' | 'pre-request' | 'after-response';

/** ignore */
export interface RequestTestResult {
  key: string;
  testCase: string;
  status: TestStatus;
  executionTime: number; // milliseconds
  errorMessage?: string;
  category: TestCategory;
}

/** ignore */
export interface TestHandler {
  (msg: string, fn: () => Promise<void>): Promise<void>;
  skip?: (msg: string, fn: () => Promise<void>) => void;
}
