let testsInObservation = new Array<Promise<void>>();

export function test(
    msg: string,
    fn: () => Promise<void>,
    log: (testResult: RequestTestResult) => void,
) {
    const observedAsyncFn = async () => {
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
                errorMessage: `${e}`,
                category: 'unknown',
            });
        }
    };

    testsInObservation.push(observedAsyncFn());
}

export function skip(
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
    (msg: string, fn: () => Promise<void>): void;
    skip?: (msg: string, fn: () => Promise<void>) => void;
};

export async function waitUntilTestsFinished() {
    try {
        await Promise.allSettled(testsInObservation);
    } catch (e) {
        throw `Failed to run test(s): ${e}`;
    } finally {
        testsInObservation = [];
    }
}
