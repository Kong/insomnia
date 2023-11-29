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
