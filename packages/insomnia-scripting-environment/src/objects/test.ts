export async function test(
    msg: string,
    fn: () => Promise<void>,
    log: (testResult: RequestTestResult) => void,
) {
    const wrapFn = async () => {
        const started = performance.now();

        try {
            await fn();

            const executionTime = performance.now() - started;
            log({
                testCase: msg,
                status: 'passed',
                executionTime,
                category: 'unknown',
            });
        } catch (e) {
            const executionTime = performance.now() - started;
            log({
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
export async function waitForAllTestsDone() {
    await Promise.allSettled(testPromises);
    testPromises = [];
}
function startTestObserver(promise: Promise<void>) {
    testPromises.push(promise);
}

export async function skip(
    msg: string,
    _: () => Promise<void>,
    log: (testResult: RequestTestResult) => void,
) {
    log({
        testCase: msg,
        status: 'skipped',
        executionTime: 0,
        category: 'unknown',
    });
}

export type TestStatus = 'passed' | 'failed' | 'skipped';
export type TestCategory = 'unknown' | 'pre-request' | 'after-response';
export interface RequestTestResult {
    testCase: string;
    status: TestStatus;
    executionTime: number; // milliseconds
    errorMessage?: string;
    category: TestCategory;
}

export interface TestHandler {
    (msg: string, fn: () => Promise<void>): Promise<void>;
    skip?: (msg: string, fn: () => Promise<void>) => void;
};
