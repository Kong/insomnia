import { initGlobalObject, InsomniaObject } from './inso-object';

const ErrorTimeout = 'executing script timeout';
const ErrorInvalidResult = 'result is invalid, null or custom value may be returned';

const executeAction = 'message-channel://hidden.browser-window/execute';

async function init() {
    const channel = new MessageChannel();

    channel.port1.onmessage = async (ev: MessageEvent) => {
        const action = ev.data.action;
        const timeout = ev.data.timeout ? ev.data.timeout : 3000;

        try {
            if (action === executeAction || action === 'message-channel://hidden.browser-window/debug') {
                const getRawGlobalObject = new Function('insomnia', 'return insomnia;');
                const rawObject = getRawGlobalObject(ev.data.options.context.insomnia);
                const insomniaObject = initGlobalObject(rawObject);

                const AsyncFunction = (async () => { }).constructor;
                const executeScript = AsyncFunction(
                    'insomnia',
                    // if possible, avoid adding code to the following part
                    `
                        const $ = insomnia, pm = insomnia;
                        ${ev.data.options.code};

                        return insomnia;
                    `
                );

                const result = await new Promise(async (resolve, reject) => {
                    const alertTimeout = () => reject({ message: `${ErrorTimeout}:${timeout}ms` });
                    const timeoutChecker = setTimeout(alertTimeout, timeout);

                    try {
                        const insoObject = await executeScript(insomniaObject);
                        clearTimeout(timeoutChecker);
                        if (insoObject instanceof InsomniaObject) {
                            resolve(insoObject.toObject());
                        } else {
                            throw { message: ErrorInvalidResult };
                        }
                    } catch (e) {
                        reject(e);
                    }
                });

                channel.port1.postMessage({
                    action: action === executeAction ? 'message-channel://caller/respond' : 'message-channel://caller/debug/respond',
                    id: ev.data.options.id,
                    result,
                });
            } else {
                console.error(`unknown action ${ev.data}`);
            }
        } catch (e) {
            channel.port1.postMessage({
                action: action === executeAction ? 'message-channel://caller/respond' : 'message-channel://caller/debug/respond',
                id: ev.data.options.id,
                error: {
                    message: e.message || 'unknown error',
                    stack: e.stack,
                },
            });
        } finally {

        }
    };

    window.postMessage('message-event://preload/publish-port', '*', [channel.port2]);

    window.onbeforeunload = () => {
        channel.port1.postMessage({
            action: 'message-channel://consumers/close',
        });
    };
}

init();
