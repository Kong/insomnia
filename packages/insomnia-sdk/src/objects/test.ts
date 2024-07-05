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
        });
    } catch (e) {
        const executionTime = performance.now() - started;
        log({
            testCase: msg,
            status: 'failed',
            executionTime,
            errorMessage: `${e}`,
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
    });
}

export type TestStatus = 'passed' | 'failed' | 'skipped';
export interface RequestTestResult {
    testCase: string;
    status: TestStatus;
    executionTime: number; // milliseconds
    errorMessage?: string;
}

export interface TestHandler {
    (msg: string, fn: () => void): void;
    skip?: (msg: string, fn: () => void) => void;
};
