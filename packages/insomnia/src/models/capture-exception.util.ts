/**
 * This is a HACK to work around inso cli using the database module used for Insomnia desktop client.
 * Now this is getting coupled with Electron side, and CLI should not be really related to the electron at all.
 * That is another tech debt.
 */
export type ExceptionCallback = (exception: unknown, captureContext?: unknown) => string;

let captureException: ExceptionCallback = (exception: unknown) => {
    console.error(exception);
    return '';
};

export function loadCaptureException() {
    return captureException;
}

export function registerCaptureException(fn: ExceptionCallback) {
    captureException = fn;
}
