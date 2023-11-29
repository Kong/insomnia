/**
 * This is a HACK to work around inso cli using the database module used for Insomnia desktop client.
 * Now this is getting coupled with Electron side, and CLI should not be really related to the electron at all.
 * That is another tech debt.
 */
export type ExceptionCallback = (exception: unknown, captureContext?: unknown) => string;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let captureException = (exception: unknown, _captureContext?: unknown) => {
    console.error(exception);
    return '';
};

if (process.versions.electron) {
    import('@sentry/electron').then(Sentry => {
        captureException = Sentry.captureException as ExceptionCallback;
    });
}

export default captureException;
