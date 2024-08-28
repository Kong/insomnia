export function test(
    msg: string,
    fn: () => void,
    log: (testResult: RequestTestResult) => void,
) {
    const started = performance.now();

    try {
        fn();
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
}

export function skip(
    msg: string,
    _: () => void,
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
    (msg: string, fn: () => void): void;
    skip?: (msg: string, fn: () => void) => void;
};
